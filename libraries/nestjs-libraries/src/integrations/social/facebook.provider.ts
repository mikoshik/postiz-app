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

    if (body.indexOf('FileUrlProcessingError') > -1 || body.indexOf('403 Restricted by robots.txt') > -1) {
      return {
        type: 'bad-body' as const,
        value: 'Unable to access media file. Please check your media URL is publicly accessible and not blocked by robots.txt',
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

  /**
   * Downloads video file from URL and returns as Buffer
   * Used when Facebook can't access the URL directly (e.g., blocked by robots.txt)
   */
  private async downloadVideoFile(videoUrl: string): Promise<Buffer> {
    try {
      console.log('Downloading video from URL:', videoUrl);
      
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log('Video downloaded successfully:', {
        sizeBytes: buffer.length,
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2)
      });
      
      return buffer;
    } catch (error) {
      console.error('Failed to download video file:', error);
      throw error;
    }
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<FacebookDto>[]
): Promise<PostResponse[]> {
    console.log('=== Facebook Post Start ===');
    console.log('Page ID:', id);
    console.log('Post Details Count:', postDetails.length);
    
    const [firstPost, ...comments] = postDetails;

    let finalId = '';
    let finalUrl = '';
    
    const isVideo = firstPost?.media?.[0]?.path?.includes('mp4');
    
    console.log('Media Info:', {
      hasMedia: !!firstPost?.media?.length,
      mediaCount: firstPost?.media?.length || 0,
      isVideo,
      mediaPath: firstPost?.media?.[0]?.path,
    });

    if (isVideo) {
        // === ЛОГИКА ДЛЯ ВИДЕО ИСТОРИЙ (STORIES) ===
        try {
            const pageId = id;
            const videoUrl = firstPost?.media?.[0]?.path!;

            console.log('=== Step 1: Starting Facebook Stories Upload ===');
            console.log('Page ID:', pageId);
            console.log('Video URL:', videoUrl);

            // --- ШАГ 1: Инициализация (Start) ---
            const startUrl = `https://graph.facebook.com/v20.0/${pageId}/video_stories?upload_phase=start&access_token=${accessToken}`;
            
            const startResponse = await this.fetch(
                startUrl,
                { method: 'POST' },
                'start story upload'
            );
            const startResult = await startResponse.json();
            
            console.log('=== Step 1 Response ===');
            console.log('Status:', startResponse.status);
            console.log('Response:', JSON.stringify(startResult, null, 2));
            
            const { upload_url, video_id } = startResult;
            
            if (!upload_url || !video_id) {
                console.error('Missing upload_url or video_id in response!');
                throw new Error(`Invalid start response: ${JSON.stringify(startResult)}`);
            }
            
            console.log('Upload URL received:', upload_url);
            console.log('Video ID received:', video_id);

            // --- ШАГ 2: Попытка загрузки через file_url, если не получится — binary upload ---
            console.log('=== Step 2: Uploading Video ===');
            
            let uploadResult: any;
            let uploadSuccess = false;

            // Сначала пробуем метод file_url (быстрый)
            try {
                console.log('Trying file_url method with URL:', videoUrl);
                
                const uploadResponse = await fetch(upload_url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `OAuth ${accessToken}`,
                        'file_url': videoUrl
                    },
                });

                console.log('Upload response status:', uploadResponse.status, uploadResponse.statusText);
                
                const uploadResultText = await uploadResponse.text();
                
                try {
                    uploadResult = JSON.parse(uploadResultText);
                    console.log('Upload result:', JSON.stringify(uploadResult, null, 2));
                } catch (e) {
                    console.error('Failed to parse upload response as JSON:', uploadResultText);
                    throw new Error(`Invalid JSON response: ${uploadResultText}`);
                }

                // Проверяем успешность
                if (uploadResult.success || uploadResult.id) {
                    uploadSuccess = true;
                    console.log('✅ Video uploaded successfully via file_url method');
                } else if (uploadResult.debug_info?.type === 'FileUrlProcessingError') {
                    // robots.txt блокирует — пробуем binary upload
                    console.warn('⚠️ file_url method blocked by robots.txt:', uploadResult.debug_info?.message);
                    console.log('🔄 Switching to binary upload method...');
                } else {
                    throw new Error(`Unexpected upload response: ${JSON.stringify(uploadResult)}`);
                }
            } catch (error) {
                console.warn('file_url method failed:', error instanceof Error ? error.message : String(error));
                console.log('🔄 Will try binary upload method...');
            }

            // Если file_url не сработал, пробуем binary upload
            if (!uploadSuccess) {
                console.log('=== Step 2b: Binary Upload Fallback ===');
                
                // Скачиваем видео
                const videoBuffer = await this.downloadVideoFile(videoUrl);
                
                // Загружаем бинарные данные с правильными заголовками для resumable upload
                console.log('Uploading binary data to Facebook');
                console.log('Buffer size:', videoBuffer.length, 'bytes');
                console.log('Buffer size MB:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');
                
                const binaryUploadResponse = await fetch(upload_url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `OAuth ${accessToken}`,
                        'offset': '0', // Начальная позиция для resumable upload
                        'file_size': videoBuffer.length.toString(), // Общий размер файла
                    },
                    body: videoBuffer,
                });

                console.log('Binary upload response status:', binaryUploadResponse.status, binaryUploadResponse.statusText);
                console.log('Response headers:', Object.fromEntries(binaryUploadResponse.headers.entries()));

                if (!binaryUploadResponse.ok) {
                    const errorText = await binaryUploadResponse.text();
                    console.error('Binary upload failed:', errorText);
                    throw new Error(`Binary upload failed: ${errorText}`);
                }

                const binaryUploadResultText = await binaryUploadResponse.text();
                console.log('Binary upload response body:', binaryUploadResultText);
                
                try {
                    uploadResult = JSON.parse(binaryUploadResultText);
                    console.log('Binary upload result:', JSON.stringify(uploadResult, null, 2));
                } catch (e) {
                    console.error('Failed to parse binary upload response:', binaryUploadResultText);
                    throw new Error(`Invalid JSON response: ${binaryUploadResultText}`);
                }

                if (!uploadResult.success && !uploadResult.id) {
                    throw new Error(`Binary upload failed: ${JSON.stringify(uploadResult)}`);
                }

                console.log('✅ Video uploaded successfully via binary method');
            }

            // --- ШАГ 3: Публикация (Finish) ---
            console.log('=== Step 3: Finishing Story Upload ===');
            console.log('Video ID:', video_id);
            
            const finishBody = {
                access_token: accessToken,
                upload_phase: 'finish',
                video_id: video_id
            };
            
            const finishResponse = await this.fetch(
                `https://graph.facebook.com/v20.0/${pageId}/video_stories`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finishBody),
                },
                'finish story upload'
            );
            
            const finishResult = await finishResponse.json();
            console.log('=== Step 3 Response ===');
            console.log('Status:', finishResponse.status);
            console.log('Response:', JSON.stringify(finishResult, null, 2));

            // Если Facebook вернул post_id, используем его
            const actualPostId = finishResult.post_id || video_id;

            finalId = actualPostId;
            finalUrl = `https://www.facebook.com/${pageId}/stories/${actualPostId}`;
            
            console.log('=== Story Upload Complete ===');
            console.log('Final Video ID:', video_id);
            console.log('Final Post ID:', actualPostId);
            console.log('Final URL:', finalUrl);
            console.log('⏳ Note: Video is processing by Facebook. Story will appear in 1-5 minutes.');

            // Опционально: проверяем статус обработки
            try {
                console.log('=== Checking Video Processing Status ===');
                const statusResponse = await this.fetch(
                    `https://graph.facebook.com/v20.0/${video_id}?fields=status&access_token=${accessToken}`,
                    { method: 'GET' },
                    'check video status'
                );
                const statusResult = await statusResponse.json();
                console.log('Video processing status:', JSON.stringify(statusResult, null, 2));
            } catch (statusError) {
                console.warn('Could not check video status (this is optional):', statusError);
            }

        } catch (error) {
            console.error('=== Facebook Stories Upload Failed ===');
            console.error('Error:', error);
            if (error instanceof Error) {
                console.error('Error Message:', error.message);
                console.error('Error Stack:', error.stack);
            }
            throw error;
        }

    } else {
        // === ЛОГИКА ДЛЯ ФОТО (FEED) ===
        console.log('=== Processing Photo Post ===');
        
        const uploadPhotos = !firstPost?.media?.length
            ? []
            : await Promise.all(
                firstPost.media.map(async (media, index) => {
                    console.log(`Uploading photo ${index + 1}/${firstPost.media.length}:`, media.path);
                    
                    const { id: photoId } = await (
                        await this.fetch(
                            `https://graph.facebook.com/v20.0/${id}/photos?access_token=${accessToken}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: media.path,
                                    published: false,
                                }),
                            },
                            'upload images slides'
                        )
                    ).json();
                    
                    console.log(`Photo ${index + 1} uploaded with ID:`, photoId);
                    return { media_fbid: photoId };
                })
            );

        console.log('Publishing feed post with', uploadPhotos.length, 'photos');
        
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
        
        console.log('Feed post published:', { postId, permalink_url });
    }

    // === ОБРАБОТКА КОММЕНТАРИЕВ ===
    const postsArray = [];
    let commentId = finalId;
    
    if (comments.length > 0 && finalId) {
        console.log('=== Processing Comments ===');
        console.log('Comments count:', comments.length);
        
        for (const [index, comment] of comments.entries()) {
            try {
                console.log(`Adding comment ${index + 1}/${comments.length}`);
                
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
                console.log(`Comment ${index + 1} added with ID:`, data.id);
                
                postsArray.push({
                    id: comment.id,
                    postId: data.id,
                    releaseURL: data.permalink_url,
                    status: 'success',
                });
            } catch (e) {
                console.error(`Error posting comment ${index + 1}:`, e);
            }
        }
    }

    console.log('=== Facebook Post Complete ===');
    console.log('Total posts created:', 1 + postsArray.length);

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
