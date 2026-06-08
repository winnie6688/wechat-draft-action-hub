const axios = require('axios');
const FormData = require('form-data');

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

let accessToken = null;
let tokenExpireTime = 0;

const getWechatAccessToken = async () => {
  const now = Date.now();
  
  if (accessToken && now < tokenExpireTime) {
    return accessToken;
  }

  try {
    const response = await axios.get(
      'https://api.weixin.qq.com/cgi-bin/token',
      {
        params: {
          grant_type: 'client_credential',
          appid: WECHAT_APP_ID,
          secret: WECHAT_APP_SECRET
        }
      }
    );

    if (response.data.access_token) {
      accessToken = response.data.access_token;
      tokenExpireTime = now + (response.data.expires_in - 60) * 1000;
      return accessToken;
    } else {
      throw new Error(`Failed to get access token: ${response.data.errmsg}`);
    }
  } catch (error) {
    throw new Error(`WeChat API error: ${error.message}`);
  }
};

const uploadImageMaterial = async (imageUrl) => {
  const token = await getWechatAccessToken();

  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'stream'
    });

    const formData = new FormData();
    formData.append('media', imageResponse.data, {
      filename: 'cover.jpg',
      contentType: imageResponse.headers['content-type'] || 'image/jpeg'
    });

    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );

    if (response.data.errcode) {
      throw new Error(`WeChat API error: ${response.data.errmsg}`);
    }

    return response.data.media_id;
  } catch (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

const createDraft = async (article) => {
  const token = await getWechatAccessToken();

  const draftData = {
    articles: [
      {
        article_type: 'news',
        title: article.title,
        author: article.author || 'Lyra',
        digest: article.digest || '',
        content: article.content_html,
        thumb_media_id: article.thumb_media_id,
        content_source_url: article.content_source_url || '',
        need_open_comment: 1,
        only_fans_can_comment: 0
      }
    ]
  };

  try {
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
      draftData
    );

    if (response.data.errcode) {
      throw new Error(`WeChat API error: ${response.data.errmsg}`);
    }

    return response.data.media_id;
  } catch (error) {
    throw new Error(`Failed to create draft: ${error.message}`);
  }
};

module.exports = {
  getWechatAccessToken,
  uploadImageMaterial,
  createDraft
};