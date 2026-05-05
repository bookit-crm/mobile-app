import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ClientsPage } from './clients.page';
import { RouterModule, Routes } from '@angular/router';
import { ClientModalComponent } from './components/client-modal/client-modal.component';
import { ClientDetailPage } from './pages/client-detail/client-detail.page';
import { AppointmentModalComponent } from '@core/components/appointment-modal/appointment-modal.component';

const routes: Routes = [{ path: '', component: ClientsPage }];

@NgModule({
  declarations: [ClientsPage, ClientModalComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    ClientDetailPage,
    AppointmentModalComponent,
  ],
})
export class ClientsPageModule {}
