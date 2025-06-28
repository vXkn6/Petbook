import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VeterinariosPage } from './veterinarios.page';

describe('VeterinariosPage', () => {
  let component: VeterinariosPage;
  let fixture: ComponentFixture<VeterinariosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VeterinariosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
