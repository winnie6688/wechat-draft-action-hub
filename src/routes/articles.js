const express = require('express');
const {
  createFeishuRecord,
  findFeishuRecordByRecordId,
  updateFeishuRecord,
  parseBitableFields
} = require('../services/feishuService');
const { uploadImageMaterial, createDraft } = require('../services/wechatService');

const router = express.Router();

// ====== 字段配置 ======
const REQUIRED_FIELDS = ['title', 'content_html', 'cover_image_url'];
const RECOMMENDED_FIELDS = ['digest', 'author'];

// 飞书多维表格字段的合法选项值
const VALID_COLUMN_OPTIONS = [
  'AI 产品落地指南',
  '边走边想',
  '书籍推荐',
  '热钱之外',
  'AI 简报'
];

const VALID_STATUS_OPTIONS = [
  'content_gen',
  'ready_to_upload',
  'uploaded_to_wechat',
  'failed'
];

const VALID_WECHAT_UPLOAD_RESULT = [
  '待审核',
  '成功上传',
  '已发布'
];

const AUTHOR_DEFAULT = 'Lyra Wang';

// PATCH 允许更新的字段
const PATCH_ALLOWED_FIELDS = [
  'title',
  'digest',
  'column',
  'content_markdown',
  'content_html',
  'cover_image_url',
  'content_source_url',
  'status'
];

// ====== 工具函数 ======
const checkArticleComplete = (article) => {
  const missingFields = [];
  const warningFields = [];

  REQUIRED_FIELDS.forEach(field => {
    if (!article[field] || String(article[field]).trim() === '') {
      missingFields.push(field);
    }
  });

  RECOMMENDED_FIELDS.forEach(field => {
    if (!article[field] || String(article[field]).trim() === '') {
      warningFields.push(field);
    }
  });

  return {
    ready: missingFields.length === 0,
    missingFields,
    warningFields
  };
};

const isValidColumn = (value) => {
  return VALID_COLUMN_OPTIONS.includes(value);
};

const isValidStatus = (value) => {
  if (Array.isArray(value)) {
    return value.every(v => VALID_STATUS_OPTIONS.includes(v));
  }
  return VALID_STATUS_OPTIONS.includes(value);
};

const isValidWechatUploadResult = (value) => {
  return VALID_WECHAT_UPLOAD_RESULT.includes(value);
};

// ====== 路由 ======

// POST 创建时允许的字段
const POST_ALLOWED_FIELDS = [
  'title',
  'digest',
  'column',
  'content_markdown',
  'content_html',
  'cover_image_url',
  'content_source_url',
  'status'
];

// 1. 创建文章草稿
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const { title, column, status } = body;

    if (!title || !column) {
      return res.status(400).json({
        success: false,
        message: 'title 和 column 为必填字段'
      });
    }

    if (!isValidColumn(column)) {
      return res.status(400).json({
        success: false,
        message: `column 必须是以下值之一: ${VALID_COLUMN_OPTIONS.join(', ')}`
      });
    }

    if (status && !isValidStatus(status)) {
      return res.status(400).json({
        success: false,
        message: `status 必须是以下值之一: ${VALID_STATUS_OPTIONS.join(', ')}`
      });
    }

    // 收集合法字段（author 不允许覆盖，始终用默认值）
    const fields = {
      title,
      column,
      author: AUTHOR_DEFAULT
    };

    POST_ALLOWED_FIELDS.forEach(key => {
      if (key === 'title' || key === 'column') return;
      const value = body[key];
      if (value === undefined || value === null || value === '') return;
      fields[key] = value;
    });

    const result = await createFeishuRecord(fields);

    res.status(201).json({
      record_id: result.record_id,
      article_id: result.fields && result.fields.article_id,
      status: Array.isArray(fields.status) ? fields.status[0] : (fields.status || '草稿'),
      message: '已在飞书创建文章草稿'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 2. 部分更新文章草稿
router.patch('/:record_id', async (req, res) => {
  try {
    const { record_id } = req.params;
    const updateData = req.body;

    const validFields = {};
    const updatedFields = [];

    Object.keys(updateData).forEach(key => {
      if (!PATCH_ALLOWED_FIELDS.includes(key)) {
        return;
      }

      const value = updateData[key];

      // 校验: 单选/多选字段的合法值
      if (key === 'column' && !isValidColumn(value)) {
        throw new Error(`column 必须是以下值之一: ${VALID_COLUMN_OPTIONS.join(', ')}`);
      }
      if (key === 'status' && !isValidStatus(value)) {
        throw new Error(`status 必须是以下值之一: ${VALID_STATUS_OPTIONS.join(', ')}`);
      }

      // 过滤掉空字符串，但允许 0 和 false 等假值
      if (value === '' || value === null || value === undefined) {
        return;
      }

      validFields[key] = value;
      updatedFields.push(key);
    });

    if (updatedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可更新的有效字段'
      });
    }

    await updateFeishuRecord(record_id, validFields);

    const updatedRecord = await findFeishuRecordByRecordId(record_id);
    const parsedFields = parseBitableFields(updatedRecord.fields);

    res.json({
      record_id,
      updated_fields: updatedFields,
      status: parsedFields.status && parsedFields.status.length > 0 ? parsedFields.status[0] : '',
      message: '已更新飞书文章草稿'
    });
  } catch (error) {
    res.status(error.message && (error.message.includes('必须') || error.message.includes('以下')) ? 400 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// 3. 检查字段完整性
router.get('/:record_id/check', async (req, res) => {
  try {
    const { record_id } = req.params;

    const record = await findFeishuRecordByRecordId(record_id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '未找到文章记录'
      });
    }

    const article = parseBitableFields(record.fields);
    article.author = article.author || AUTHOR_DEFAULT;

    const { ready, missingFields, warningFields } = checkArticleComplete(article);

    const updateFields = {
      missing_fields: missingFields,
      warning_fields: warningFields
    };

    if (ready) {
      updateFields.status = 'ready_to_upload';
    }

    await updateFeishuRecord(record_id, updateFields);

    const message = ready
      ? '文章字段完整，可以上传到微信公众号'
      : `缺少必填字段: ${missingFields.join(', ')}`;

    res.json({
      ready,
      missing_fields: missingFields,
      warning_fields: warningFields,
      message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 4. 上传到微信公众号
router.post('/:record_id/upload-to-wechat', async (req, res) => {
  try {
    const { record_id } = req.params;

    const record = await findFeishuRecordByRecordId(record_id);

    if (!record) {
      return res.status(404).json({
        success: false,
        ready: false,
        message: '未找到文章记录'
      });
    }

    const article = parseBitableFields(record.fields);
    article.author = article.author || AUTHOR_DEFAULT;

    const { ready, missingFields, warningFields } = checkArticleComplete(article);

    if (!ready) {
      await updateFeishuRecord(record_id, {
        missing_fields: missingFields,
        warning_fields: warningFields,
        status: 'failed'
      });

      return res.json({
        success: false,
        ready: false,
        missing_fields: missingFields,
        message: `缺少必填字段: ${missingFields.join(', ')}`
      });
    }

    const thumbMediaId = await uploadImageMaterial(article.cover_image_url);
    const wechatTitle = article.column
      ? `${article.column} | ${article.title}`
      : article.title;
    const wechatDraftMediaId = await createDraft({
      ...article,
      title: wechatTitle,
      author: article.author,
      thumb_media_id: thumbMediaId
    });

    await updateFeishuRecord(record_id, {
      wechat_draft_media_id: wechatDraftMediaId,
      wechat_upload_result: `已上传到微信草稿箱，media_id=${wechatDraftMediaId}`,
      status: 'uploaded_to_wechat',
      missing_fields: [],
      warning_fields: warningFields
    });

    res.json({
      success: true,
      ready: true,
      wechat_draft_media_id: wechatDraftMediaId,
      message: '已成功创建微信公众号草稿，请到公众号后台审核'
    });
  } catch (error) {
    try {
      await updateFeishuRecord(req.params.record_id, {
        status: 'failed',
        wechat_upload_result: `上传失败：${error.message}`
      });
    } catch (e) {}

    res.status(500).json({
      success: false,
      ready: false,
      message: error.message
    });
  }
});

module.exports = router;
