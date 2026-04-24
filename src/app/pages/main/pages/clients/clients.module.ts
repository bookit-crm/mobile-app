import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ClientsPage } from './clients.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: ClientsPage }];
@NgModule({
  declarations: [ClientsPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class ClientsPageModule {}
