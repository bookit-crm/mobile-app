import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ProductsPage } from './products.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: ProductsPage }];
@NgModule({
  declarations: [ProductsPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class ProductsPageModule {}
