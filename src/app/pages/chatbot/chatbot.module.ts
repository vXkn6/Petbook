import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

import { ChatbotPageRoutingModule } from './chatbot-routing.module';
import { ChatbotPage } from './chatbot.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AngularFireModule,
    AngularFirestoreModule,
    ChatbotPageRoutingModule
  ],
  declarations: [ChatbotPage]
})
export class ChatbotPageModule {}