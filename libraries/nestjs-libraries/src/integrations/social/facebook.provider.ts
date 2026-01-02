import {
  AnalyticsData,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import dayjs from 'dayjs';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { FacebookDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/facebook.dto';
import { DribbbleDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/dribbble.dto';

export class FacebookProvider extends SocialAbstract implements SocialProvider {
  identifier = 'facebook';
  name = 'Facebook Page';
  isBetweenSteps = true;
  scopes = [
    'pages_show_list',
    'business_management',
    'pages_manage_posts',
    'pages_manage_engagement',
    'pages_read_engagement',
    'read_insights',
  ];
  override maxConcurrentJob = 3; // Facebook has reasonable rate limits
  editor = 'normal' as const;
  maxLength() {
    return 63206;
  }
  dto = FacebookDto;

  override handleErrors(body: string):
    | {
        type: 'refresh-token' | 'bad-body';
        value: string;
      }
    | undefined {
    // Access token validation errors - require re-authentication
    if (body.indexOf('Error validating access token') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Please re-authenticate your Facebook account',
      };
    }

    if (body.indexOf('490') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Access token expired, please re-authenticate',
      };
    }

    if (body.indexOf('REVOKED_ACCESS_TOKEN') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Access token has been revoked, please re-authenticate',
      };
    }

    if (body.indexOf('1366046') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Photos should be smaller than 4 MB and saved as JPG, PNG',
      };
    }

    if (body.indexOf('1390008') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'You are posting too fast, please slow down',
      };
    }

    // Content policy violations
    if (body.indexOf('1346003') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Content flagged as abusive by Facebook',
      };
    }

    if (body.indexOf('1404006') > -1) {
      return {
        type: 'bad-body' as const,
        value:
          "We couldn't post your comment, A security check in facebook required to proceed.",
      };
    }

    if (body.indexOf('1404102') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Content violates Facebook Community Standards',
      };
    }

    // Permission errors
    if (body.indexOf('1404078') > -1) {
      return {
        type: 'refresh-token' as const,
        value: 'Page publishing authorization required, please re-authenticate',
      };
    }

    if (body.indexOf('1609008') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Cannot post Facebook.com links',
      };
    }

    // Parameter validation errors
    if (body.indexOf('2061006') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Invalid URL format in post content',
      };
    }

    if (body.indexOf('1349125') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Invalid content format',
      };
    }

    if (body.indexOf('Name parameter too long') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Post content is too long',
      };
    }

    // Service errors - checking specific subcodes first
    if (body.indexOf('1363047') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Facebook service temporarily unavailable',
      };
    }

    if (body.indexOf('1609010') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Facebook service temporarily unavailable',
      };
    }

    return undefined;
  }

  async refreshToken(refresh_token: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const state = makeId(6);
    return {
      url:
        'https://www.facebook.com/v20.0/dialog/oauth' +
        `?client_id=${process.env.FACEBOOK_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(
          `${process.env.FRONTEND_URL}/integrations/social/facebook`
        )}` +
        `&state=${state}` +
        `&scope=${this.scopes.join(',')}`,
      codeVerifier: makeId(10),
      state,
    };
  }

  async reConnect(
    id: string,
    requiredId: string,
    accessToken: string
  ): Promise<AuthTokenDetails> {
    const information = await this.fetchPageInformation(
      accessToken,
      requiredId
    );

    return {
      id: information.id,
      name: information.name,
      accessToken: information.access_token,
      refreshToken: information.access_token,
      expiresIn: dayjs().add(59, 'days').unix() - dayjs().unix(),
      picture: information.picture,
      username: information.username,
    };
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const getAccessToken = await (
      await fetch(
        'https://graph.facebook.com/v20.0/oauth/access_token' +
          `?client_id=${process.env.FACEBOOK_APP_ID}` +
          `&redirect_uri=${encodeURIComponent(
            `${process.env.FRONTEND_URL}/integrations/social/facebook${
              params.refresh ? `?refresh=${params.refresh}` : ''
            }`
          )}` +
          `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
          `&code=${params.code}`
      )
    ).json();

    const { access_token } = await (
      await fetch(
        'https://graph.facebook.com/v20.0/oauth/access_token' +
          '?grant_type=fb_exchange_token' +
          `&client_id=${process.env.FACEBOOK_APP_ID}` +
          `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
          `&fb_exchange_token=${getAccessToken.access_token}&fields=access_token,expires_in`
      )
    ).json();

    const { data } = await (
      await fetch(
        `https://graph.facebook.com/v20.0/me/permissions?access_token=${access_token}`
      )
    ).json();

    const permissions = data
      .filter((d: any) => d.status === 'granted')
      .map((p: any) => p.permission);
    this.checkScopes(this.scopes, permissions);

    const { id, name, picture } = await (
      await fetch(
        `https://graph.facebook.com/v20.0/me?fields=id,name,picture&access_token=${access_token}`
      )
    ).json();

    return {
      id,
      name,
      accessToken: access_token,
      refreshToken: access_token,
      expiresIn: dayjs().add(59, 'days').unix() - dayjs().unix(),
      picture: picture?.data?.url || '',
      username: '',
    };
  }

  async pages(accessToken: string) {
    const { data } = await (
      await fetch(
        `https://graph.facebook.com/v20.0/me/accounts?fields=id,username,name,picture.type(large)&access_token=${accessToken}`
      )
    ).json();

    return data;
  }

  async fetchPageInformation(accessToken: string, pageId: string) {
    const {
      id,
      name,
      access_token,
      username,
      picture: {
        data: { url },
      },
    } = await (
      await fetch(
        `https://graph.facebook.com/v20.0/${pageId}?fields=username,access_token,name,picture.type(large)&access_token=${accessToken}`
      )
    ).json();

    return {
      id,
      name,
      access_token,
      picture: url,
      username,
    };
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<FacebookDto>[]
): Promise<PostResponse[]> {
    const [firstPost, ...comments] = postDetails;

    let finalId = '';
    let finalUrl = '';
    
    // Проверяем, является ли файл видео (более надежная проверка)
    const isVideo = firstPost?.media?.[0]?.path?.includes('mp4');

    if (isVideo) {
        // === ЛОГИКА ДЛЯ ВИДЕО ИСТОРИЙ (STORIES) ===
        try {
            const pageId = id;
            const videoUrl = firstPost?.media?.[0]?.path!;

            // --- ШАГ 1: Инициализация (Start) ---
            // Запрашиваем у FB разрешение на загрузку и получаем upload_url
            const startResponse = await this.fetch(
                `https://graph.facebook.com/v20.0/${pageId}/video_stories?upload_phase=start&access_token=${accessToken}`,
                { method: 'POST' },
                'start story upload'
            );
            const { upload_url, video_id } = await startResponse.json();

            // --- ШАГ 2: Передача ссылки (Upload via Hosted File) ---
            // Отправляем ссылку в заголовке. FB скачает файл сам.
            // Используем нативный fetch, так как URL (rupload) отличается от graph api
            const uploadResponse = await fetch(upload_url, {
                method: 'POST',
                headers: {
                    'Authorization': `OAuth ${accessToken}`,
                    'file_url': videoUrl // Передаем ссылку здесь!
                },
                // Тело пустое, так как файл качает сам Фейсбук
            });

            const uploadResult = await uploadResponse.json();

            // Если FB не вернул success или id, значит что-то пошло не так
            if (!uploadResult.success && !uploadResult.id) {
                // Если вдруг метод hosted file не сработал, тут можно добавить фоллбэк на загрузку бинарником
                throw new Error(`Facebook upload failed: ${JSON.stringify(uploadResult)}`);
            }

            // --- ШАГ 3: Публикация (Finish) ---
            // Подтверждаем, что файл передан, и публикуем историю
            await this.fetch(
                `https://graph.facebook.com/v20.0/${pageId}/video_stories`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        access_token: accessToken,
                        upload_phase: 'finish',
                        video_id: video_id
                    }),
                },
                'finish story upload'
            );

            // Успех
            finalId = video_id;
            // У историй нет постоянной ссылки (они исчезают), но можно сформировать примерную
            finalUrl = `https://www.facebook.com/${pageId}/stories/${video_id}`;

        } catch (error) {
            console.error('Failed to upload video to Facebook stories:', error);
            throw error; // Пробрасываем ошибку, чтобы Postiz знал о сбое
        }

    } else {
        // === ЛОГИКА ДЛЯ ФОТО (FEED) ===
        // Оставляем старую логику для картинок, она выглядит рабочей для ленты
        const uploadPhotos = !firstPost?.media?.length
            ? []
            : await Promise.all(
                firstPost.media.map(async (media) => {
                    const { id: photoId } = await (
                        await this.fetch(
                            `https://graph.facebook.com/v20.0/${id}/photos?access_token=${accessToken}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: media.path,
                                    published: false, // Грузим, но не публикуем сразу
                                }),
                            },
                            'upload images slides'
                        )
                    ).json();
                    return { media_fbid: photoId };
                })
            );

        // Публикуем пост с прикрепленными фото
        const { id: postId, permalink_url } = await (
            await this.fetch(
                `https://graph.facebook.com/v20.0/${id}/feed?access_token=${accessToken}&fields=id,permalink_url`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...(uploadPhotos?.length ? { attached_media: uploadPhotos } : {}),
                        ...(firstPost?.settings?.url ? { link: firstPost.settings.url } : {}),
                        message: firstPost.message,
                        published: true,
                    }),
                },
                'finalize upload'
            )
        ).json();

        finalUrl = permalink_url;
        finalId = postId;
    }

    // === ОБРАБОТКА КОММЕНТАРИЕВ ===
    const postsArray = [];
    let commentId = finalId; // Комментируем созданный пост или историю (если API позволяет)
    
    // Внимание: API Фейсбука может не позволять комментировать Истории через API.
    // Этот блок сработает корректно для постов в ленте.
    if (comments.length > 0 && finalId) {
        for (const comment of comments) {
            try {
                const data = await (
                    await this.fetch(
                        `https://graph.facebook.com/v20.0/${commentId}/comments?access_token=${accessToken}&fields=id,permalink_url`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...(comment.media?.length ? { attachment_url: comment.media[0].path } : {}),
                                message: comment.message,
                            }),
                        },
                        'add comment'
                    )
                ).json();

                commentId = data.id;
                postsArray.push({
                    id: comment.id,
                    postId: data.id,
                    releaseURL: data.permalink_url,
                    status: 'success',
                });
            } catch (e) {
                console.error('Error posting comment:', e);
                // Не прерываем весь процесс из-за ошибки комментария
            }
        }
    }

    return [
        {
            id: firstPost.id,
            postId: finalId,
            releaseURL: finalUrl,
            status: 'success',
        },
        ...postsArray,
    ];
}

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    const until = dayjs().endOf('day').unix();
    const since = dayjs().subtract(date, 'day').unix();

    const { data } = await (
      await fetch(
        `https://graph.facebook.com/v20.0/${id}/insights?metric=page_impressions_unique,page_posts_impressions_unique,page_post_engagements,page_daily_follows,page_video_views&access_token=${accessToken}&period=day&since=${since}&until=${until}`
      )
    ).json();

    return (
      data?.map((d: any) => ({
        label:
          d.name === 'page_impressions_unique'
            ? 'Page Impressions'
            : d.name === 'page_post_engagements'
            ? 'Posts Engagement'
            : d.name === 'page_daily_follows'
            ? 'Page followers'
            : d.name === 'page_video_views'
            ? 'Videos views'
            : 'Posts Impressions',
        percentageChange: 5,
        data: d?.values?.map((v: any) => ({
          total: v.value,
          date: dayjs(v.end_time).format('YYYY-MM-DD'),
        })),
      })) || []
    );
  }
}
