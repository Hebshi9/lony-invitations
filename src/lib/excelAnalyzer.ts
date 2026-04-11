import * as XLSX from 'xlsx';

export interface ColumnAnalysis {
    columnIndex: number;
    columnName: string;
    detectedType: 'name' | 'phone' | 'table' | 'companions' | 'category' | 'card_number' | 'unknown';
    confidence: number;
    samples: string[];
}

export interface ExcelAnalysisResult {
    analysis: ColumnAnalysis[];
    suggestions: Record<string, number>;
    warnings: string[];
    totalRows: number;
}

/**
 * Analyze Excel file and detect column types intelligently
 */
export async function analyzeExcelColumns(file: File): Promise<ExcelAnalysisResult> {
    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (data.length < 2) {
            throw new Error('الملف يجب أن يحتوي على صف رئيسي وصف واحد على الأقل من البيانات');
        }

        const headers = data[0] as string[];
        const rows = data.slice(1, Math.min(11, data.length)); // Sample first 10 rows

        const analysis: ColumnAnalysis[] = [];
        const suggestions: Record<string, number> = {};
        const warnings: string[] = [];

        // Analyze each column
        headers.forEach((header, index) => {
            const samples = rows
                .map(row => row[index])
                .filter(val => val !== null && val !== undefined && val !== '')
                .map(val => String(val).trim());

            const detection = detectColumnType(header, samples);

            analysis.push({
                columnIndex: index,
                columnName: header || `عمود ${index + 1}`,
                detectedType: detection.type as any,
                confidence: detection.confidence,
                samples: samples.slice(0, 3)
            });

            // Auto-suggest if confidence > 70%
            if (detection.confidence > 0.7 && detection.type !== 'unknown') {
                suggestions[detection.type] = index;
            }
        });

        // Validate required fields
        if (!suggestions.name) {
            warnings.push('⚠️ لم يتم العثور على عمود الأسماء تلقائياً');
        }
        if (!suggestions.phone) {
            warnings.push('💡 لم يتم العثور على عمود الجوال (اختياري)');
        }

        return {
            analysis,
            suggestions,
            warnings,
            totalRows: data.length - 1
        };
    } catch (error: any) {
        throw new Error(`خطأ في تحليل الملف: ${error.message}`);
    }
}

/**
 * Detect column type based on header and sample data
 */
function detectColumnType(header: string, samples: string[]): {
    type: string;
    confidence: number;
} {
    if (!samples.length) {
        return { type: 'unknown', confidence: 0 };
    }

    const patterns = {
        name: {
            headerPatterns: [
                /اسم|name|guest|ضيف|الاسم|Guest Name/i
            ],
            dataValidation: (val: string) => {
                // Arabic or English names, 3-50 characters
                return /^[\u0600-\u06FFa-zA-Z\s.]{3,50}$/.test(val);
            },
            weight: 1.0
        },
        phone: {
            headerPatterns: [
                /جوال|هاتف|phone|mobile|رقم|الجوال|tel|telephone/i
            ],
            dataValidation: (val: string) => {
                // Any phone number: digits with possible +
                const cleaned = val.replace(/[\s\-()]/g, '');
                return /^\+?\d{8,20}$/.test(cleaned);
            },
            weight: 0.9
        },
        table: {
            headerPatterns: [
                /طاولة|table|رقم الطاولة|Table Number|table no/i
            ],
            dataValidation: (val: string) => {
                // Table numbers/codes: alphanumeric, 1-10 chars
                return /^[A-Za-z0-9\u0600-\u06FF\-_]{1,10}$/i.test(val);
            },
            weight: 0.8
        },
        companions: {
            headerPatterns: [
                /مرافق|companion|عدد المرافقين|مرافقين|Companions|Number of Companions/i
            ],
            dataValidation: (val: string) => {
                // 0-99 companions
                return /^\d{1,2}$/.test(val) && parseInt(val) >= 0 && parseInt(val) < 100;
            },
            weight: 0.7
        },
        category: {
            headerPatterns: [
                /فئة|category|vip|نوع|Type|Class/i
            ],
            dataValidation: (val: string) => {
                // Common categories
                return /^(VIP|vip|عادي|normal|premium|بريميوم|عام|general)/i.test(val);
            },
            weight: 0.6
        },
        card_number: {
            headerPatterns: [
                /رقم البطاقة|تسلسل|سيريال|Card Number|Serial|Sequence|No\.|Num/i
            ],
            dataValidation: (val: string) => {
                // Numeric or alphanumeric, short (e.g. 001, A-01)
                return /^[a-zA-Z0-9\-]{1,10}$/.test(val);
            },
            weight: 0.8
        }
    };

    let bestMatch = { type: 'unknown', confidence: 0 };

    Object.entries(patterns).forEach(([type, config]) => {
        let score = 0;

        // Check header match (60% weight)
        const headerMatch = config.headerPatterns.some(pattern =>
            pattern.test(header)
        );
        if (headerMatch) {
            score += 0.6 * config.weight;
        }

        // Check data samples (40% weight)
        const validSamples = samples.filter(sample =>
            config.dataValidation(sample)
        );
        const dataMatchRatio = validSamples.length / samples.length;
        score += dataMatchRatio * 0.4 * config.weight;

        if (score > bestMatch.confidence) {
            bestMatch = { type, confidence: score };
        }
    });

    return bestMatch;
}

/**
 * Parse Excel with custom column mapping
 */
export async function parseExcelWithMapping(
    file: File,
    mapping: Record<string, number>
): Promise<any[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    const rows = data.slice(1); // Skip header

    return rows.map((row, index) => {
        const guest: any = {
            _rowIndex: index + 2 // Excel row number (1-indexed + header)
        };

        // Map columns based on user selection
        Object.entries(mapping).forEach(([field, columnIndex]) => {
            const value = row[columnIndex];
            if (value !== null && value !== undefined && value !== '') {
                guest[field] = String(value).trim();
            }
        });

        return guest;
    }).filter(guest => {
        // Filter out completely empty rows
        return Object.keys(guest).length > 1; // More than just _rowIndex
    });
}

/**
 * Validate parsed guests data
 */
export function validateGuestsData(guests: any[]): {
    valid: any[];
    errors: Array<{ row: number; field: string; message: string }>;
} {
    const valid: any[] = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];

    guests.forEach(guest => {
        const rowErrors: string[] = [];

        // Validate name (required)
        if (!guest.name || guest.name.length < 1) {
            errors.push({
                row: guest._rowIndex,
                field: 'name',
                message: 'الاسم مطلوب'
            });
            rowErrors.push('name');
        }

        // Validate phone (optional, but keep it permissive for international numbers)
        if (guest.phone) {
            const cleaned = guest.phone.replace(/[\s\-()]/g, '');
            // Just check if it has at least 8 digits and starts with a plus or digit
            if (!/^\+?\d{8,20}$/.test(cleaned)) {
                errors.push({
                    row: guest._rowIndex,
                    field: 'phone',
                    message: 'رقم الجوال يجب أن يحتوي على 8 أرقام على الأقل'
                });
                // We will nullify the invalid phone instead of dropping the guest entirely
                guest.phone = null;
            }
        }

        // Validate companions (optional, but must be number if provided)
        if (guest.companions_count !== undefined) {
            const count = parseInt(guest.companions_count);
            if (isNaN(count) || count < 0 || count > 99) {
                errors.push({
                    row: guest._rowIndex,
                    field: 'companions_count',
                    message: 'عدد المرافقين يجب أن يكون رقم بين 0 و 99'
                });
                rowErrors.push('companions_count');
            } else {
                guest.companions_count = count;
            }
        }

        // Add to valid list if no errors
        if (rowErrors.length === 0) {
            valid.push(guest);
        }
    });

    return { valid, errors };
}
