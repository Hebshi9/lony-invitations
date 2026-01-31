import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Info, AlertCircle, Zap } from 'lucide-react';
import { EventFeatures, FEATURE_CATEGORIES, validateFeatures } from '../lib/features';

interface FeaturesSelectorProps {
    features: Partial<EventFeatures>;
    onChange: (features: Partial<EventFeatures>) => void;
    showErrors?: boolean;
}

export const FeaturesSelector: React.FC<FeaturesSelectorProps> = ({
    features,
    onChange,
    showErrors = true,
}) => {
    const { valid, errors } = validateFeatures(features);

    const toggleFeature = (key: keyof EventFeatures) => {
        const newFeatures = { ...features, [key]: !features[key] };

        // Auto-enable dependencies
        if (key === 'offline_mode' && newFeatures.offline_mode) {
            newFeatures.require_inspector_app = true;
        }

        onChange(newFeatures);
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-lony-navy font-amiri">
                    الميزات الإضافية
                </h3>
                <p className="text-gray-500 text-sm">
                    اختر الميزات المتقدمة المطلوبة لهذا الحدث
                </p>
            </div>

            {/* Validation Errors */}
            {showErrors && !valid && errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        {errors.map((error, i) => (
                            <p key={i} className="text-red-700 text-sm">
                                {error}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Feature Categories */}
            {Object.entries(FEATURE_CATEGORIES).map(([categoryKey, category]) => (
                <Card
                    key={categoryKey}
                    className="border-none shadow-lg bg-white/80 backdrop-blur overflow-hidden"
                >
                    <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <span className="text-2xl">{category.icon}</span>
                            <span className="text-lony-navy">{category.title}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                        {category.features.map((feature) => {
                            const isEnabled = features[feature.key] === true;
                            const isDisabled = feature.requires?.some(
                                (req) => !features[req as keyof EventFeatures]
                            );

                            return (
                                <label
                                    key={feature.key}
                                    className={`
                    group relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer
                    ${isEnabled
                                            ? 'border-lony-gold bg-lony-gold/5 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                                >
                                    {/* Checkbox */}
                                    <div className="relative flex items-center h-6">
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={() => !isDisabled && toggleFeature(feature.key)}
                                            disabled={isDisabled}
                                            className="w-6 h-6 rounded border-2 border-gray-300 text-lony-gold focus:ring-2 focus:ring-lony-gold/50 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-gray-800 text-base leading-tight">
                                                    {feature.label}
                                                </h4>
                                                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                                    {feature.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-2">
                                            {feature.requiresBackend && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                                                    <Zap className="w-3 h-3" />
                                                    يحتاج سيرفر
                                                </span>
                                            )}
                                            {feature.requiresConfig && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                                                    <Info className="w-3 h-3" />
                                                    يحتاج إعدادات إضافية
                                                </span>
                                            )}
                                            {feature.note && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                                                    {feature.note}
                                                </span>
                                            )}
                                            {feature.requires && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
                                                    <Info className="w-3 h-3" />
                                                    يتطلب: {feature.requires.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </CardContent>
                </Card>
            ))}

            {/* Summary */}
            <div className="bg-gradient-to-r from-lony-navy to-blue-900 text-white rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-lg mb-1">الميزات المفعلة</h4>
                        <p className="text-blue-200 text-sm">
                            {Object.values(features).filter((v) => v === true).length} ميزة إضافية
                        </p>
                    </div>
                    <div className="text-4xl">✨</div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 space-y-1">
                    <p className="font-bold">💡 ملاحظة</p>
                    <p>
                        جميع الميزات الأساسية (QR Codes، البطاقات الرقمية، إدارة الطاولات، وغيرها) موجودة تلقائياً.
                    </p>
                    <p>هذه القائمة تحتوي فقط على الميزات الإضافية والمتقدمة.</p>
                </div>
            </div>
        </div>
    );
};

export default FeaturesSelector;
