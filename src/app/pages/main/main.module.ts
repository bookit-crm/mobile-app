import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SideMenuComponent } from '@core/components/side-menu/side-menu.component';
import { SupportChatWidgetComponent } from '@core/components/support-chat-widget/support-chat-widget.component';
import { MainPage } from './main.page';
import { MainPageRoutingModule } from './main-routing.module';

@NgModule({
  declarations: [MainPage],
  imports: [
    CommonModule,
    IonicModule,
    SideMenuComponent,
    SupportChatWidgetComponent,
    MainPageRoutingModule,
  ],
})
export class MainPageModule {}

