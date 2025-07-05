import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatAnalyticsPageRoutingModule } from './chat-analytics-routing.module';

import { ChatAnalyticsPage } from './chat-analytics.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatAnalyticsPageRoutingModule
  ],
  declarations: [ChatAnalyticsPage]
})
export class ChatAnalyticsPageModule {}
