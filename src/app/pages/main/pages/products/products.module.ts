import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { ProductsPage } from './products.page';
import { ProductModalComponent } from './components/product-modal/product-modal.component';
import { ProductHistoryComponent } from './components/product-history/product-history.component';

const routes: Routes = [{ path: '', component: ProductsPage }];

@NgModule({
  declarations: [
    ProductsPage,
    ProductModalComponent,
    ProductHistoryComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
})
export class ProductsPageModule {}
