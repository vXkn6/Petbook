import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PetfilePage } from './petfile.page';

const routes: Routes = [
  {
    path: '',
    component: PetfilePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PetfilePageRoutingModule {}
