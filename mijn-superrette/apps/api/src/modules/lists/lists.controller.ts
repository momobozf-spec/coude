import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import {
  compareListSchema,
  createInviteSchema,
  createListItemSchema,
  createListSchema,
  itemSelectionSchema,
  smartBasketSchema,
  updateListItemSchema,
  updateListSchema,
  type BasketComparisonDto,
  type CreateListInput,
  type CreateListItemInput,
  type InviteDto,
  type InvitePreviewDto,
  type ItemSelectionInput,
  type ListActivityDto,
  type ShoppingListDetailDto,
  type ShoppingListDto,
  type ShoppingListItemDto,
  type SmartBasketDto,
  type SmartBasketInput,
  type UpdateListItemInput,
} from '@superrette/validation';
import { CurrentUser, type AuthUser } from '../../common/auth.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { BasketService } from './basket.service.js';
import { ListsService } from './lists.service.js';

@Controller('v1')
export class ListsController {
  constructor(
    private readonly lists: ListsService,
    private readonly basket: BasketService,
  ) {}

  @Get('lists')
  all(@CurrentUser() user: AuthUser): Promise<ShoppingListDto[]> {
    return this.lists.lists(user.id);
  }

  @Post('lists')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createListSchema)) body: CreateListInput,
  ): Promise<ShoppingListDto> {
    return this.lists.create(user.id, body);
  }

  @Get('lists/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ShoppingListDetailDto> {
    return this.lists.detail(id, user.id);
  }

  @Patch('lists/:id')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateListSchema)) body: Partial<CreateListInput>,
  ): Promise<ShoppingListDto> {
    return this.lists.rename(id, user.id, body);
  }

  @Delete('lists/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.lists.remove(id, user.id);
  }

  @Post('lists/:id/items')
  addItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createListItemSchema)) body: CreateListItemInput,
  ): Promise<ShoppingListItemDto> {
    return this.lists.addItem(id, user.id, body);
  }

  @Patch('lists/:id/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodPipe(updateListItemSchema)) body: UpdateListItemInput,
  ): Promise<ShoppingListItemDto> {
    return this.lists.updateItem(id, itemId, user.id, body);
  }

  @Delete('lists/:id/items/:itemId')
  @HttpCode(204)
  async deleteItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    await this.lists.deleteItem(id, itemId, user.id);
  }

  @Put('lists/:id/items/:itemId/selection')
  @HttpCode(204)
  async select(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodPipe(itemSelectionSchema)) body: ItemSelectionInput,
  ): Promise<void> {
    await this.lists.setSelection(id, itemId, user.id, body);
  }

  @Post('lists/:id/compare')
  @HttpCode(200)
  compare(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(compareListSchema)) body: { retailerIds?: string[] },
  ): Promise<BasketComparisonDto> {
    return this.basket.compare(id, user.id, body.retailerIds);
  }

  @Post('lists/:id/smart-basket')
  @HttpCode(200)
  smart(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(smartBasketSchema)) body: SmartBasketInput,
  ): Promise<SmartBasketDto> {
    return this.basket.smart(id, user.id, body);
  }

  @Get('lists/:id/activity')
  activity(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ListActivityDto[]> {
    return this.lists.activityFeed(id, user.id);
  }

  @Post('lists/:id/invites')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(createInviteSchema)) body: z.infer<typeof createInviteSchema>,
  ): Promise<InviteDto> {
    return this.lists.createInvite(id, user.id, body.role as 'EDITOR' | 'VIEWER');
  }

  @Delete('lists/:id/members/:userId')
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    await this.lists.removeMember(id, memberId, user.id);
  }

  @Get('invites/:token')
  preview(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.lists.previewInvite(token);
  }

  @Post('invites/:token/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string): Promise<ShoppingListDto> {
    return this.lists.acceptInvite(token, user.id);
  }
}
