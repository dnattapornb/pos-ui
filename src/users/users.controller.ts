import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

// Remove passwordHash from response
export class UserResponseDto {
  id: number;
  username: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private mapToResponse(user: User): UserResponseDto {
    return new UserResponseDto({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  @Get('users')
  async getAllUsers() {
    const users = await this.usersService.getAllUsers();
    return users.map((u) => this.mapToResponse(u));
  }

  @Get('user/:id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.getUserById(id);
    return this.mapToResponse(user);
  }

  @Post('user')
  async createUser(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    return this.mapToResponse(user);
  }

  @Put('user/:id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.updateUser(id, updateUserDto);
    return this.mapToResponse(user);
  }
}
