import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SupportPage } from './support.page';

const routes: Routes = [{ path: '', component: SupportPage }];

@NgModule({
  imports: [SupportPage, RouterModule.forChild(routes)],
})
export class SupportPageModule {}

