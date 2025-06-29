import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PetfilePage } from './petfile.page';

describe('PetfilePage', () => {
  let component: PetfilePage;
  let fixture: ComponentFixture<PetfilePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PetfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
