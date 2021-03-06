import { ChangeDetectionStrategy, Component, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BannerService } from 'app/core/banner.service';
import { DataForUiHolder } from 'app/core/data-for-ui-holder';
import { LoginService } from 'app/core/login.service';
import { MenuService } from 'app/core/menu.service';
import { PushNotificationsService } from 'app/core/push-notifications.service';
import { SidenavComponent } from 'app/core/sidenav.component';
import { Messages } from 'app/messages/messages';
import { blank, setRootSpinnerVisible } from 'app/shared/helper';
import { LayoutService } from 'app/shared/layout.service';
import { trim } from 'lodash';
import { BehaviorSubject } from 'rxjs';
import { DataForUi } from 'app/api/models';
import { StateManager } from 'app/core/state-manager';
import { BreadcrumbService } from 'app/core/breadcrumb.service';
import { Configuration } from 'app/configuration';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {

  @ViewChild(SidenavComponent) sidenav: SidenavComponent;

  initialized$ = new BehaviorSubject(false);
  loggingOut$ = new BehaviorSubject(false);

  title: string;
  menuBar: boolean;

  constructor(
    private ngZone: NgZone,
    private router: Router,
    private dataForUiHolder: DataForUiHolder,
    public login: LoginService,
    public menu: MenuService,
    public layout: LayoutService,
    private banner: BannerService,
    public messages: Messages,
    private stateManager: StateManager,
    private breadcrumb: BreadcrumbService,
    // PushNotificationsService is here because it is not directly used by any
    // other component / service, but handles itself the push notifications.
    // It would otherwise be removed from the built app by tree-shaking.
    private push: PushNotificationsService,
  ) {
  }

  ngOnInit() {
    window['navigate'] = (url: string | HTMLAnchorElement, event?: Event) => {
      this.ngZone.run(() => {
        if (typeof url === 'object') {
          url = url.href;
        }
        this.menu.navigate({ url: url, event: event });
      });
    };
    this.menuBar = Configuration.menuBar;
    this.push.initialize();
    this.banner.initialize();
    this.router.routeReuseStrategy.shouldReuseRoute = () => false;
    this.layout.setTitle();
    this.dataForUiHolder.subscribe(dataForUi => {
      if (dataForUi != null) {
        this.doInitialize(dataForUi);
      }
    });
    if (this.dataForUiHolder.dataForUi) {
      this.doInitialize(this.dataForUiHolder.dataForUi);
    }
    this.login.subscribeForLoggingOut(flag => this.loggingOut$.next(flag));

    // Some browsers (like Firefox) show an outline on focused anchors.
    // After the page is loaded, blur the menus, so none will be outlined
    this.layout.currentPage$.subscribe(() => {
      const focused = document.activeElement as HTMLElement;
      if (focused.tagName === 'A') {
        try {
          focused.blur();
        } catch (e) { }
      }
    });

    // Indicate that Cyclos has finished loading, to prevent the root spinner from being shown on the onload event
    self['cyclosLoaded'] = true;

    // Hide the spinner, showing the application
    setRootSpinnerVisible(false);
  }

  private doInitialize(dataForUi: DataForUi) {
    this.initialized$.next(true);
    this.prepareContent();

    // Handle redirects on urgent situations
    const auth = (dataForUi || {}).auth || {};
    let redirect: string = null;
    if (auth.expiredPassword) {
      redirect = '/expired-password';
    } else if (auth.pendingAgreements) {
      redirect = '/pending-agreements';
    }
    if (redirect && this.router.url !== redirect) {
      setTimeout(() => {
        this.breadcrumb.clear();
        this.stateManager.clear();
        this.router.navigateByUrl(redirect);
      }, 1);
    }
  }

  private prepareContent() {
    const style = getComputedStyle(document.body);
    this.applyFont(style);
    this.applyThemeColor(style);
  }

  private applyFont(style: CSSStyleDeclaration) {
    const url = trim(style.getPropertyValue('--font-import-url'), '\" ');
    if (blank(url)) {
      return;
    }
    const id = 'fontStyle';
    let element: HTMLLinkElement = document.getElementById(id) as HTMLLinkElement;
    if (!element) {
      element = document.createElement('link');
      element.id = id;
      element.rel = 'stylesheet';
      document.head.appendChild(element);
      element.href = url;
    } else if (element.href !== url) {
      element.href = url;
    }
  }

  private applyThemeColor(style: CSSStyleDeclaration) {
    const primaryColor = style.getPropertyValue('--primary').trim();
    if (blank(primaryColor)) {
      return;
    }
    this.layout.primaryColor = primaryColor;
    this.layout.secondaryColor = style.getPropertyValue('--secondary').trim();
    const id = 'themeColorMeta';
    let meta: HTMLMetaElement = document.getElementById(id) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = id;
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = style.getPropertyValue('--theme-color').trim();
  }
}
