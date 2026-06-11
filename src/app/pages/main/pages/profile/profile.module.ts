import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ImagePickerComponent } from '@core/components/image-picker/image-picker.component';
import { PhoneInputComponent } from '@core/components/phone-input/phone-input.component';
import { ProfilePage } from './profile.page';

const routes: Routes = [{ path: '', component: ProfilePage }];

@NgModule({
  declarations: [ProfilePage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    TranslateModule,
    ImagePickerComponent,
    PhoneInputComponent,
  ],
})
export class ProfilePageModule {}
