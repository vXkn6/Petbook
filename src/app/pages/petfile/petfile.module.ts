import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule} from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PetfilePageRoutingModule } from './petfile-routing.module';

import { PetfilePage } from './petfile.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PetfilePageRoutingModule,
    ReactiveFormsModule,
    
  ],
  declarations: [PetfilePage]
})
export class PetfilePageModule {}
