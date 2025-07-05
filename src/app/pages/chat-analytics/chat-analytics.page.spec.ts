import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatAnalyticsPage } from './chat-analytics.page';

describe('ChatAnalyticsPage', () => {
  let component: ChatAnalyticsPage;
  let fixture: ComponentFixture<ChatAnalyticsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatAnalyticsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
