import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ClientsPage } from './clients.page';
import { RouterModule, Routes } from '@angular/router';
import { ClientModalComponent } from './components/client-modal/client-modal.component';
import { ClientDetailPage } from './pages/client-detail/client-detail.page';

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
  ],
})
export class ClientsPageModule {}
