import { Injectable } from '@angular/core';
import { CustomFieldDetailed, PasswordInput, NotificationsStatus, Notification } from 'app/api/models';
import { SnackBarProvider, SnackBarOptions } from 'app/core/snack-bar-provider';
import { FieldLabelPosition } from 'app/shared/base-form-field.component';
import { ConfirmationComponent } from 'app/shared/confirmation.component';
import { NotificationType } from 'app/shared/notification-type';
import { NotificationComponent } from 'app/shared/notification.component';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Observable, Subject, Subscription, BehaviorSubject } from 'rxjs';
import { DataForUiHolder } from 'app/core/data-for-ui-holder';
import { NotificationsService } from 'app/api/services';
import { first } from 'rxjs/operators';
import { NextRequestState } from 'app/core/next-request-state';
import { PushNotificationProvider } from 'app/core/push-notification-provider';

/**
 * Reference to a notification
 */
export class NotificationRef {
  private _sub: Subscription;
  private _onClosed = new Subject<void>();

  constructor(
    private _ref: BsModalRef,
    onClosed: Observable<NotificationComponent>) {
    this._sub = onClosed.subscribe(other => {
      if (this.notification === other) {
        this._onClosed.next(null);
        this._onClosed.complete();
        this._sub.unsubscribe();
      }
    });
  }

  get onClosed(): Observable<void> {
    return this._onClosed.asObservable();
  }

  get notification(): NotificationComponent {
    return this._ref.content;
  }

  close() {
    this._ref.hide();
  }
}

/**
 * The confirm calls its callback using this parameter
 */
export interface ConfirmCallbackParams {
  confirmationPassword?: string;
  customValues?: { [key: string]: string };
}

/**
 * Service used to manage notifications being displayed for users
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  /** The currently open notification */
  private currentNotification: NotificationRef;

  private _snackBarProvider: SnackBarProvider;
  set snackBarProvider(provider: SnackBarProvider) {
    this._snackBarProvider = provider;
  }

  private _pushNotificationProvider: PushNotificationProvider;
  set pushNotificationProvider(provider: PushNotificationProvider) {
    this._pushNotificationProvider = provider;
  }

  onClosed = new Subject<NotificationComponent>();

  notificationsStatus$ = new BehaviorSubject<NotificationsStatus>(null);

  constructor(
    private modal: BsModalService,
    nextRequestState: NextRequestState,
    notificationsService: NotificationsService,
    dataForUiHolder: DataForUiHolder
  ) {
    this.modal.onHidden.subscribe(() => {
      if (this.currentNotification) {
        this.onClosed.next(this.currentNotification.notification);
        this.currentNotification = null;
      }
    });
    // Subscript for user changes: update the notification status
    dataForUiHolder.subscribe(dataForUi => {
      const auth = (dataForUi ? dataForUi.auth : null) || {};
      if (auth.user && ((auth.permissions || {}).notifications || {}).enable) {
        nextRequestState.ignoreNextError = true;
        notificationsService.notificationsStatus().pipe(first()).subscribe(status => {
          this.notificationsStatus$.next(status);
        });
        this.notificationsStatus$.next(null);
      } else {
        this.notificationsStatus$.next(null);
      }
    });
  }

  /**
   * Shows a snack bar message (quick message on the bottom)
   */
  snackBar(message: string, options?: SnackBarOptions): void {
    this._snackBarProvider.show(message, options);
  }

  /**
   * Shows a Cyclos notification that was pushed to the client
   * @param notification The incoming notification
   */
  newNotificationPush(notification: Notification): void {
    this._pushNotificationProvider.show(notification);
  }

  /**
   * Shows a confirmation dialog, invoking a callback when the user confirms.
   * Supports a confirmation password.
   * @param options The confirmation options:
   * - title: An optional title for the dialog
   * - message: An optional message
   * - cancelLabel: Allows overriding the cancel label
   * - confirmLabel: Allows overriding the confirm label
   * - customFields: When set, shows additional fields in the confirmation dialog
   * - labelPosition: When additional fields are shown, represents their label's position
   * - passwordInput: If a confirmation password is required to confirm
   * - callback: Function called when confirming. When a confirmation password is used,
   *   the typed password is passed as parameter.
   */
  confirm(options: {
    title?: string,
    message?: string,
    cancelLabel?: string,
    confirmLabel?: string,
    labelPosition?: FieldLabelPosition,
    customFields?: CustomFieldDetailed[],
    callback: (params: ConfirmCallbackParams) => void,
    passwordInput?: PasswordInput
  }): void {
    this.modal.show(ConfirmationComponent, {
      class: 'modal-form',
      initialState: options
    });
  }

  /**
   * Shows an error notification
   * @param message The notification message
   * @returns The dialog reference
   */
  error(message: string, allowClose = true): NotificationRef {
    return this.showNotification(NotificationType.ERROR, message, allowClose);
  }

  /**
   * Shows a warning notification
   * @param message The notification message
   * @returns The dialog reference
   */
  warning(message: string, allowClose = true): NotificationRef {
    return this.showNotification(NotificationType.WARNING, message, allowClose);
  }

  /**
   * Shows an information notification
   * @param message The notification message
   * @returns The dialog reference
   */
  info(message: string, allowClose = true): NotificationRef {
    return this.showNotification(NotificationType.INFO, message, allowClose);
  }

  /**
   * Shows a notification with the given type
   * @param type The notification type to show
   * @param message The notification message
   * @returns The dialog reference
   */
  showNotification(type: NotificationType, message: string, allowClose = true): NotificationRef {
    // Close the current notification, if any
    this.close();

    const modalRef = this.modal.show(NotificationComponent, {
      class: 'notification',
      initialState: {
        type: type,
        message: message,
        allowClose: allowClose
      }
    });

    // Store the currently opened notification
    this.currentNotification = new NotificationRef(modalRef, this.onClosed);
    return this.currentNotification;
  }

  /**
   * Closes the currently visible notification, if any
   */
  close(): void {
    if (this.currentNotification) {
      this.currentNotification.close();
    }
  }

}
