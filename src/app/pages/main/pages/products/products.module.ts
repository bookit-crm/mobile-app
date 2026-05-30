import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ImagePickerComponent } from '@core/components/image-picker/image-picker.component';
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
    TranslateModule,
    RouterModule.forChild(routes),
    ImagePickerComponent,
  ],
})
export class ProductsPageModule {}
