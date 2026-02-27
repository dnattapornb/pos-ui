import { Body, Controller, Post } from '@nestjs/common';

interface LineAuthBody {
    idToken: string;
}

interface AuthResponse {
    accessToken: string;
}

@Controller('api/auth')
export class AuthController {
    @Post('line')
    lineAuth(@Body() body: LineAuthBody): AuthResponse {
        return {
            accessToken: 'mock_jwt_token_for_' + body.idToken.substring(0, 10),
        };
    }
}
