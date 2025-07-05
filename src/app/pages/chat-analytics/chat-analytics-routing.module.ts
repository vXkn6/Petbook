import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChatAnalyticsPage } from './chat-analytics.page';

const routes: Routes = [
  {
    path: '',
    component: ChatAnalyticsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatAnalyticsPageRoutingModule {}
