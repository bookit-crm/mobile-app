import { NgModule } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ExpensesPage } from './expenses.page';
import { ExpenseFormModalComponent } from './components/expense-form-modal/expense-form-modal.component';

const routes: Routes = [{ path: '', component: ExpensesPage }];

@NgModule({
  declarations: [ExpensesPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    RouterModule.forChild(routes),
    TranslateModule,
    // Standalone modal component
    ExpenseFormModalComponent,
  ],
})
export class ExpensesPageModule {}
