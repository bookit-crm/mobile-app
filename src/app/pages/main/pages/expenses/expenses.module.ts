import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ExpensesPage } from './expenses.page';
import { RouterModule, Routes } from '@angular/router';
const routes: Routes = [{ path: '', component: ExpensesPage }];
@NgModule({
  declarations: [ExpensesPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
})
export class ExpensesPageModule {}
