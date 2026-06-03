import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { ClientsPage } from './clients.page';
import { RouterModule, Routes } from '@angular/router';
import { ClientModalComponent } from './components/client-modal/client-modal.component';
import { ClientDetailPage } from './pages/client-detail/client-detail.page';
import { AppointmentModalComponent } from '@core/components/appointment-modal/appointment-modal.component';
import { PhoneInputComponent } from '@core/components/phone-input/phone-input.component';

const routes: Routes = [{ path: '', component: ClientsPage }];

@NgModule({
  declarations: [ClientsPage, ClientModalComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    TranslateModule,
    RouterModule.forChild(routes),
    ClientDetailPage,
    AppointmentModalComponent,
    PhoneInputComponent,
  ],
})
export class ClientsPageModule {}
