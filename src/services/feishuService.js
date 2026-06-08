const axios = require('axios');

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_APP_TOKEN = process.env.FEISHU_APP_TOKEN;
const FEISHU_TABLE_ID = process.env.FEISHU_TABLE_ID;

let tenantAccessToken = null;
let tokenExpireTime = 0;

const getFeishuTenantAccessToken = async () => {
  const now = Date.now();

  if (tenantAccessToken && now < tokenExpireTime) {
    return tenantAccessToken;
  }

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      }
    );

    if (response.data.code === 0) {
      tenantAccessToken = response.data.tenant_access_token;
      tokenExpireTime = now + (response.data.expire - 60) * 1000;
      return tenantAccessToken;
    } else {
      throw new Error(`Failed to get tenant access token: ${response.data.msg}`);
    }
  } catch (error) {
    throw new Error(`Feishu API error: ${error.message}`);
  }
};

const createFeishuRecord = async (fields) => {
  const token = await getFeishuTenantAccessToken();

  const recordData = {
    fields: formatFieldsForBitable(fields)
  };

  try {
    const response = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records`,
      recordData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return response.data.data.record;
    } else {
      throw new Error(`Failed to create record: ${response.data.msg}`);
    }
  } catch (error) {
    throw new Error(`Feishu API error: ${error.message}`);
  }
};

const findFeishuRecordByRecordId = async (recordId) => {
  const token = await getFeishuTenantAccessToken();

  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (response.data.code === 0) {
      return response.data.data.record;
    } else {
      throw new Error(`Failed to find record: ${response.data.msg}`);
    }
  } catch (error) {
    throw new Error(`Feishu API error: ${error.message}`);
  }
};

const updateFeishuRecord = async (recordId, fields) => {
  const token = await getFeishuTenantAccessToken();

  const updateData = {
    fields: formatFieldsForBitable(fields)
  };

  try {
    const response = await axios.put(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/records/${recordId}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return response.data.data.record;
    } else {
      throw new Error(`Failed to update record: ${response.data.msg}`);
    }
  } catch (error) {
    throw new Error(`Feishu API error: ${error.message}`);
  }
};

const formatFieldsForBitable = (fields) => {
  const formatted = {};

  Object.keys(fields).forEach(key => {
    const value = fields[key];

    if (value === null || value === undefined) {
      return;
    }

    switch (key) {
      case 'cover_image_url':
      case 'content_source_url':
        if (typeof value === 'string' && value) {
          formatted[key] = {
            link: value,
            text: value
          };
        }
        break;

      case 'status':
        if (Array.isArray(value)) {
          formatted[key] = value;
        } else if (typeof value === 'string' && value) {
          formatted[key] = [value];
        }
        break;

      case 'missing_fields':
      case 'warning_fields':
        if (typeof value === 'string' && value) {
          formatted[key] = value;
        } else if (Array.isArray(value) && value.length > 0) {
          formatted[key] = value.join(', ');
        }
        break;

      case 'column':
      case 'title':
      case 'author':
      case 'digest':
      case 'content_markdown':
      case 'content_html':
      case 'wechat_upload_result':
      case 'wechat_draft_media_id':
        if (typeof value === 'string' && value !== '') {
          formatted[key] = value;
        }
        break;

      default:
        formatted[key] = value;
    }
  });

  return formatted;
};

const parseBitableFields = (fields) => {
  const parsed = {};

  Object.keys(fields).forEach(key => {
    const value = fields[key];

    switch (key) {
      case 'cover_image_url':
      case 'content_source_url':
        if (value && typeof value === 'object' && value.link) {
          parsed[key] = value.link;
        } else if (typeof value === 'string') {
          parsed[key] = value;
        } else {
          parsed[key] = '';
        }
        break;

      case 'status':
        if (Array.isArray(value)) {
          parsed[key] = value;
        } else {
          parsed[key] = [];
        }
        break;

      case 'missing_fields':
      case 'warning_fields':
        if (typeof value === 'string' && value) {
          parsed[key] = value.split(',').map(s => s.trim()).filter(Boolean);
        } else if (Array.isArray(value)) {
          parsed[key] = value;
        } else {
          parsed[key] = [];
        }
        break;

      default:
        parsed[key] = value;
    }
  });

  return parsed;
};

module.exports = {
  getFeishuTenantAccessToken,
  createFeishuRecord,
  findFeishuRecordByRecordId,
  updateFeishuRecord,
  formatFieldsForBitable,
  parseBitableFields
};
