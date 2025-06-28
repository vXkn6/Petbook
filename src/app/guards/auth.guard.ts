import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';
import { CanActivateFn, Router } from '@angular/router';
import { AutheticationService } from '../services/authetication.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AutheticationService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (isAuthenticated) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};
