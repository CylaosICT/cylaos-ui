import { Component, ChangeDetectionStrategy, Injector } from '@angular/core';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { BaseComponent } from 'app/shared/base.component';
import { UsersService } from 'app/api/services';
import { UserDataForEdit, UserEdit } from 'app/api/models';
import { FormGroup, FormBuilder, FormControl, Validators } from '@angular/forms';
import { ApiHelper } from 'app/shared/api-helper';
import { cloneDeep } from 'lodash';

const BASIC_FIELDS = ['name', 'username', 'email'];

/**
 * Edits the logged user's profile
 */
@Component({
  selector: 'edit-my-profile',
  templateUrl: 'edit-my-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditMyProfileComponent extends BaseComponent {

  constructor(
    injector: Injector,
    private usersService: UsersService,
    private formBuilder: FormBuilder) {
    super(injector);
    // Everything is dynamic!
    this.form = formBuilder.group({
      hiddenFields: []
    });
  }

  loaded = new BehaviorSubject(false);
  id: string;
  data: UserDataForEdit;
  user: UserEdit;
  form: FormGroup;
  editableFields: string[] = [];
  confirmationPassword: FormControl;

  ngOnInit() {
    super.ngOnInit();
    this.id = this.login.user.id;
    this.usersService.getUserDataForEdit({ user: this.id })
      .subscribe(data => {
        this.data = data;
        this.user = data.user;
        this.buildForm();
        this.loaded.next(true);
      });
  }

  private buildForm() {
    const data = this.data;
    const user = this.user;
    const fields = data.profileFieldActions || {};

    this.form.setControl('version', this.formBuilder.control(user.version));

    // Get the editable fields
    for (const field in fields) {
      if (fields.hasOwnProperty(field)) {
        const fieldActions = fields[field];
        if (fieldActions.edit) {
          this.editableFields.push(field);
        }
      }
    }

    // Process the basic fields
    for (const field of BASIC_FIELDS) {
      if (fields[field] && fields[field].edit) {
        this.form.setControl(field, this.formBuilder.control(user[field]));
      } else {
        this.form.removeControl(field);
      }
    }
    // Set the custom fields control
    const editableCustomFields = data.customFields.filter(cf => this.editableFields.includes(cf.internalName));
    this.form.setControl('customValues',
      ApiHelper.customValuesFormGroup(this.formBuilder, editableCustomFields));
    this.form.patchValue({ hiddenFields: this.user.hiddenFields });

    if (data.confirmationPasswordInput) {
      this.form.setControl('confirmationPassword', this.formBuilder.control('', Validators.required));
    } else {
      this.form.removeControl('confirmationPassword');
    }
  }

  save() {
    const user = cloneDeep(this.form.value);
    // The confirmationPassword property is in the form, but not in the UserEdit
    delete user.confirmationPassword;
    // Instead, it is a separated parameter
    const confirmationPassword = this.form.value.confirmationPassword || '';
    this.usersService.updateUser({
      user: this.id,
      body: user,
      confirmationPassword: confirmationPassword
    }).subscribe(() => {
      this.notification.info(this.messages.userEditMyProfileSaved());
      this.router.navigate(['users', 'my-profile']);
    });
  }
}