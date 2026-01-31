// Message Templates Service
export const messageTemplates = {
    // ========== TWO-PHASE WORKFLOW TEMPLATES ==========

    general: {
        name: 'دعوة عامة (المرحلة الأولى)',
        text: `مرحباً {{name}} 👋

نتشرف بدعوتك لحضور {{event}}
📅 التاريخ: {{date}}
📍 المكان: {{location}}

يرجى الرد بـ "نعم" أو "موافق" لتأكيد الحضور وسنرسل لك بطاقة الدعوة الخاصة بك مع رمز QR للدخول.

نسعد بحضورك! 🎉`
    },

    personalized: {
        name: 'بطاقة شخصية (المرحلة الثانية)',
        text: `عزيزنا {{name}} 🎊

شكراً لتأكيد حضورك! 
إليك بطاقة الدعوة الخاصة بك 👇

يرجى إحضار هذه البطاقة معك يوم الحفل للمسح الضوئي عند الدخول.

نراك قريباً! ✨`
    },

    // ========== ORIGINAL TEMPLATES ==========

    default: {
        name: 'القالب الافتراضي',
        text: `مرحباً {{name}}! 👋

يسعدنا دعوتك لحضور {{event}}
📅 التاريخ: {{date}}
📍 المكان: {{location}}

نتطلع لرؤيتك! 🎉`
    },

    formal: {
        name: 'رسمي',
        text: `السيد/ة {{name}} المحترم/ة

يشرفنا دعوتكم لحضور {{event}}
التاريخ: {{date}}
المكان: {{location}}

نأمل تشريفنا بحضوركم الكريم.`
    },

    casual: {
        name: 'غير رسمي',
        text: `هلا {{name}}! 😊

ننتظرك في {{event}}
يوم {{date}}
المكان: {{location}}

لا تفوتها! 🎊`
    },

    wedding: {
        name: 'زفاف',
        text: `بسم الله الرحمن الرحيم

يسعدنا دعوتكم لحضور حفل زفاف
{{event}}

يوم {{date}}
في {{location}}

نتشرف بحضوركم 💐`
    },

    birthday: {
        name: 'عيد ميلاد',
        text: `🎂 مرحباً {{name}}!

أنت مدعو لحضور حفلة عيد ميلاد
{{event}}

📅 {{date}}
📍 {{location}}

استعد للمرح! 🎈🎉`
    }
};

/**
 * Replace template variables with actual values
 */
export function fillTemplate(template, data) {
    let message = template;

    // Replace all variables
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        message = message.replace(regex, data[key] || '');
    });

    return message;
}

/**
 * Get available template variables from guest and event data
 */
export function getTemplateVariables(guest, event) {
    return {
        name: guest.name,
        event: event.name,
        date: formatDate(event.date),
        location: event.location || 'سيتم الإعلان عنه',
        serial: guest.serial || '',
        table: guest.table_no || '',
        // Add any custom data from guest
        ...(guest.custom_data || {})
    };
}

/**
 * Format date in Arabic
 */
function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    return date.toLocaleDateString('ar-SA', options);
}

/**
 * Validate template (check for required variables)
 */
export function validateTemplate(template, availableVars) {
    const requiredVars = template.match(/{{(\w+)}}/g) || [];
    const missing = [];

    requiredVars.forEach(varWithBraces => {
        const varName = varWithBraces.replace(/{{|}}/g, '');
        if (!availableVars.hasOwnProperty(varName)) {
            missing.push(varName);
        }
    });

    return {
        isValid: missing.length === 0,
        missingVars: missing
    };
}

/**
 * Get message for specific phase (general or personalized)
 */
export function getMessageForPhase(phase, guest, event, customMessage = null) {
    const variables = getTemplateVariables(guest, event);

    if (customMessage) {
        return fillTemplate(customMessage, variables);
    }

    const templateKey = phase === 'personalized' ? 'personalized' : 'general';
    const template = messageTemplates[templateKey]?.text || messageTemplates.default.text;

    return fillTemplate(template, variables);
}

export default messageTemplates;
