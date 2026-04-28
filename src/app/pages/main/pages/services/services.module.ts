import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ServicesPage } from './services.page';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [{ path: '', component: ServicesPage }];

@NgModule({
  declarations: [ServicesPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
})
export class ServicesPageModule {}
