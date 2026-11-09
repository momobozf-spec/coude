import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  addShoppingListItemSchema,
  basketCompareInputSchema,
  createShoppingListSchema,
  updateShoppingListItemSchema,
  updateShoppingListSchema,
  type AddShoppingListItemInput,
  type BasketCompareInput,
  type BasketCompareResult,
  type CreateShoppingListInput,
  type SessionUser,
  type ShoppingList,
  type ShoppingListSummary,
  type UpdateShoppingListInput,
  type UpdateShoppingListItemInput,
} from '@superette/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { ListsService } from './lists.service';

const idSchema = z.string().regex(/^[a-z0-9]{10,40}$/i, 'Ongeldig id');
const idPipe = new ZodValidationPipe(idSchema);

/** Boodschappenlijsten. Alles vereist een account; eigenaarschap wordt in de service gecontroleerd. */
@Controller('compare/lists')
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<ShoppingListSummary[]> {
    return this.lists.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(createShoppingListSchema)) input: CreateShoppingListInput): Promise<ShoppingList> {
    return this.lists.create(user.id, input);
  }

  @Get(':listId')
  get(@CurrentUser() user: SessionUser, @Param('listId', idPipe) listId: string): Promise<ShoppingList> {
    return this.lists.get(user.id, listId);
  }

  @Patch(':listId')
  update(
    @CurrentUser() user: SessionUser,
    @Param('listId', idPipe) listId: string,
    @Body(new ZodValidationPipe(updateShoppingListSchema)) input: UpdateShoppingListInput,
  ): Promise<ShoppingList> {
    return this.lists.update(user.id, listId, input);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: SessionUser, @Param('listId', idPipe) listId: string): Promise<void> {
    return this.lists.remove(user.id, listId);
  }

  @Post(':listId/items')
  addItem(
    @CurrentUser() user: SessionUser,
    @Param('listId', idPipe) listId: string,
    @Body(new ZodValidationPipe(addShoppingListItemSchema)) input: AddShoppingListItemInput,
  ): Promise<ShoppingList> {
    return this.lists.addItem(user.id, listId, input);
  }

  @Patch(':listId/items/:itemId')
  updateItem(
    @CurrentUser() user: SessionUser,
    @Param('listId', idPipe) listId: string,
    @Param('itemId', idPipe) itemId: string,
    @Body(new ZodValidationPipe(updateShoppingListItemSchema)) input: UpdateShoppingListItemInput,
  ): Promise<ShoppingList> {
    return this.lists.updateItem(user.id, listId, itemId, input);
  }

  @Delete(':listId/items/:itemId')
  removeItem(@CurrentUser() user: SessionUser, @Param('listId', idPipe) listId: string, @Param('itemId', idPipe) itemId: string): Promise<ShoppingList> {
    return this.lists.removeItem(user.id, listId, itemId);
  }

  /** Rekent de lijst door: per winkel, goedkoopste combinatie en gebalanceerde keuze. */
  @Post(':listId/compare')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  compare(
    @CurrentUser() user: SessionUser,
    @Param('listId', idPipe) listId: string,
    @Body(new ZodValidationPipe(basketCompareInputSchema)) input: BasketCompareInput,
  ): Promise<BasketCompareResult> {
    return this.lists.compare(user.id, listId, input);
  }
}
