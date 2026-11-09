import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Vereist een geldig Bearer-token van een actieve klant. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
