import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Integration } from '@prisma/client';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import dayjs from 'dayjs';

export class NineNineNine extends SocialAbstract implements SocialProvider {
  identifier = 'nineninenine';
  name = '999';
  isBetweenSteps = false;
  scopes: string[] = [];
  editor = 'markdown' as const;

  maxLength() {
    return 2000;
  }

  async customFields() {
    return [
      {
        key: 'apiKey',
        label: 'API Key',
        validation: '/^.+$/',
        type: 'text' as const,
      },
      {
        key: 'phoneNumber',
        label: 'Phone Number (Номер телефона)',
        validation: '/^.+$/',
        type: 'text' as const,
      },
      {
        key: 'location',
        label: 'Location (Местоположение)',
        validation: '/^.+$/',
        type: 'text' as const,
      },
    ];
  }

  async generateAuthUrl(input: any) {
    const state = makeId(17);
    const code = Buffer.from(JSON.stringify(input)).toString('base64');
    return {
      url: `${process.env.FRONTEND_URL}/integrations/social/callback?code=${code}&state=${state}`,
      codeVerifier: makeId(10),
      state,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }): Promise<AuthTokenDetails | string> {
    try {
      const { apiKey, phoneNumber, location } = JSON.parse(
        Buffer.from(params.code, 'base64').toString()
      );

      // Сохраняем API ключ и номер телефона в accessToken
      const tokenData = JSON.stringify({ apiKey, phoneNumber, location });
      const accessToken = Buffer.from(tokenData).toString('base64');

      return {
        accessToken: accessToken,
        refreshToken: '',
        expiresIn: dayjs().add(100, 'year').unix() - dayjs().unix(),
        id: makeId(10),
        name: `999 User (${phoneNumber})`,
        picture: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
        username: phoneNumber,
      } as AuthTokenDetails;
    } catch (err) {
      return (
        'Authentication failed: ' +
        (err instanceof Error ? err.message : String(err))
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      accessToken: '',
      refreshToken: '',
      expiresIn: dayjs().add(100, 'year').unix() - dayjs().unix(),
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'https://rvm-auto-admin.xyz/ai-api';
    
    console.log('[NineNineNine.post] Начало публикации...');
    console.log('[NineNineNine.post] postDetails count:', postDetails.length);
    
    // Извлекаем данные интеграции (телефон из accessToken)
    let phoneNumber: string | undefined;
    try {
      const tokenData = JSON.parse(Buffer.from(accessToken, 'base64').toString());
      phoneNumber = tokenData.phoneNumber;
      console.log('[NineNineNine.post] Phone from integration:', phoneNumber);
    } catch (e) {
      console.log('[NineNineNine.post] Could not parse accessToken');
    }
    
    const results: PostResponse[] = [];
    
    for (const post of postDetails) {
      try {
        // Settings находятся внутри каждого post
        const settings = post.settings || {};
        
        console.log('[NineNineNine.post] Post ID:', post.id);
        console.log('[NineNineNine.post] Settings:', JSON.stringify(settings, null, 2));
        
        // Извлекаем regionId из settings
        const regionId = settings.regionId as string || '12900'; // Кишинёв по умолчанию
        
        // Собираем URLs изображений из поста
        const images: string[] = (post.media || [])
          .filter((m: any) => m.url || m.path)
          .map((m: any) => m.url || m.path);
        
        console.log(`[NineNineNine.post] Images: ${images.length} шт.`);
        console.log(`[NineNineNine.post] Region ID: ${regionId}`);
        
        // Собираем features из settings
        const features: Array<{ id: string; value: string; unit?: string }> = [];
        
        // Проходим по всем полям settings и собираем feature_*
        for (const [key, value] of Object.entries(settings)) {
          if (key.startsWith('feature_') && value !== undefined && value !== null && value !== '') {
            // Пропускаем поля unit — они обрабатываются вместе с основным полем
            if (key.endsWith('_unit')) continue;
            
            const featureId = key.replace('feature_', '');
            
            // Проверяем есть ли unit для этого поля
            const unitKey = `feature_${featureId}_unit`;
            const unit = settings[unitKey] as string | undefined;
            
            features.push({
              id: featureId,
              value: String(value),
              ...(unit && { unit }),
            });
          }
        }
        
        console.log(`[NineNineNine.post] Features: ${features.length} шт.`);
        console.log('[NineNineNine.post] Features data:', JSON.stringify(features, null, 2));
        
        // Формируем запрос для Python API
        const requestBody = {
          images,
          features,
          region_id: regionId,
          phone_number: phoneNumber,
        };
        
        console.log('[NineNineNine.post] Sending to Python API:', JSON.stringify(requestBody, null, 2));
        
        // Вызываем Python API
        const response = await fetch(`${PYTHON_API_URL}/api/create-advert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        const result = await response.json();
        console.log('[NineNineNine.post] Response:', result);
        
        if (!response.ok || !result.success) {
          // Парсим ошибку для понятного сообщения пользователю
          let errorMessage = 'Ошибка публикации на 999.md';
          
          if (result.details) {
            try {
              const errorDetails = JSON.parse(result.details);
              if (errorDetails.error?.errors) {
                const errors = errorDetails.error.errors
                  .map((e: any) => `${e.feature_id}: ${e.message}`)
                  .join(', ');
                errorMessage = `Ошибка 999.md: ${errors}`;
              }
            } catch {
              errorMessage = result.error || result.details || errorMessage;
            }
          } else if (result.error) {
            errorMessage = result.error;
          }
          
          console.error('[NineNineNine.post] Error:', errorMessage);
          
          // Выбрасываем исключение чтобы пользователь увидел ошибку
          throw new Error(errorMessage);
        }
        
        results.push({
          id: post.id,
          postId: result.advert_id || makeId(10),
          releaseURL: result.url || 'https://999.md',
          status: 'posted',
        });
        
      } catch (error) {
        console.error('[NineNineNine.post] Exception:', error);
        // Перебрасываем ошибку чтобы она дошла до пользователя
        throw error;
      }
    }
    
    return results;
  }
}