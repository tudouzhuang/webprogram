// /js/utils/luckysheetExporter.js

/**
 * 【最终通用版 - 兼容性增强模式】
 * 将 Luckysheet 数据转换为 ExcelJS Workbook。
 * * 核心修复：
 * 1. 使用 worksheet.dataValidations.add 代替 cell.dataValidation，提高 LuckyExcel 解析成功率。
 * 2. 修复 Import 报错。
 * 3. 强制双引号处理下拉列表。
 */
export async function exportWithExcelJS(dataSource) {
    // 1. 获取全局 ExcelJS 对象
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS) {
        console.error("未找到 ExcelJS 全局对象！请确保已引入 exceljs.min.js");
        throw new Error("ExcelJS 库未加载");
    }

    console.log("【Luckysheet Exporter】: 启动兼容性增强模式 (Validation Add Mode)...");

    // 2. 数据源清洗与标准化
    let sheetsArray;
    if (Array.isArray(dataSource)) {
        sheetsArray = dataSource;
    } else if (dataSource && dataSource.sheets && typeof dataSource.sheets === 'object') {
        sheetsArray = Object.values(dataSource.sheets);
    } else {
        console.error("数据源格式错误:", dataSource);
        throw new Error("工作表数据格式不正确");
    }

    if (!sheetsArray || sheetsArray.length === 0) {
        throw new Error("工作表数据为空");
    }

    const workbook = new ExcelJS.Workbook();
    const sortedSheets = sheetsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const sheet of sortedSheets) {
        if (!sheet) continue;

        // 名字清洗
        const sheetName = (sheet.name || 'Sheet1').replace(/[\*:\?\/\[\]\\]/g, '');
        const worksheet = workbook.addWorksheet(sheetName);

        // 3. 设置列宽 (columnlen)
        if (sheet.config && sheet.config.columnlen) {
            Object.entries(sheet.config.columnlen).forEach(([c, w]) => {
                worksheet.getColumn(parseInt(c) + 1).width = w / 7.5;
            });
        }

        // 4. 设置行高 (rowlen)
        if (sheet.config && sheet.config.rowlen) {
            Object.entries(sheet.config.rowlen).forEach(([r, h]) => {
                worksheet.getRow(parseInt(r) + 1).height = h * 0.75;
            });
        }

        // 5. 填充单元格数据 (Value & Style)
        const cellDataList = sheet.celldata || [];
        cellDataList.forEach(cellData => {
            const r = cellData.r;
            const c = cellData.c;

            // 获取 ExcelJS 单元格 (索引从 1 开始)
            const cell = worksheet.getCell(r + 1, c + 1);
            const luckysheetCell = cellData.v;

            if (luckysheetCell) {
                // 5.1 处理值与公式
                if (luckysheetCell.f) {
                    const fText = luckysheetCell.f.startsWith('=') ? luckysheetCell.f.substring(1) : luckysheetCell.f;
                    cell.value = { formula: fText };
                } else if (luckysheetCell.ct && luckysheetCell.ct.v != null) {
                    cell.value = luckysheetCell.ct.v;
                } else {
                    cell.value = luckysheetCell.m ?? luckysheetCell.v;
                }

                // 5.2 处理样式
                Object.assign(cell, mapLuckysheetStyleToExcelJS(luckysheetCell));
            }
        });

        // ============================================================
        // 🐞【DEBUG模式】边框逻辑 (替换原有的边框处理代码)
        // ============================================================

        // 【探针 1】检查 config 对象是否存在
        if (!sheet.config) {
            console.warn(`[DEBUG-01] Sheet "${sheetName}" 居然没有 config 对象！跳过边框处理。`);
        } else if (!sheet.config.borderInfo) {
            console.warn(`[DEBUG-02] Sheet "${sheetName}" 有 config，但 borderInfo 为空/undefined。`, sheet.config);
        } else {
            // 【探针 2】确认读到了数据
            const bList = sheet.config.borderInfo;
            console.group(`[DEBUG-03] Sheet "${sheetName}" 发现 ${bList.length} 条边框原始数据`);
            console.log("原始 borderInfo 数据快照:", JSON.parse(JSON.stringify(bList)));

            // 样式映射表
            const borderStyleMap = {
                "1": "thin", "2": "hair", "3": "dotted", "4": "dashed", "5": "dashDot",
                "6": "dashDotDot", "7": "double", "8": "medium", "9": "mediumDashed",
                "10": "mediumDashDot", "11": "mediumDashDotDot", "12": "slantDashDot", "13": "thick"
            };

            // 2. 辅助函数：构建 ExcelJS 边框对象 (修复 #000 变灰色/失效的问题)
            const getBorderObj = (styleId, colorHex) => {
                if (!styleId) return undefined;

                // 默认黑色
                let c = colorHex || '#000000';

                // 🚨 核心修复：处理 #000 这种简写，ExcelJS 不认 3 位 Hex
                if (c.length === 4 && c.startsWith('#')) {
                    // #000 -> #000000
                    c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
                }

                // 转换为 ARGB (FF + Hex)
                const argb = c.replace('#', 'FF');

                return {
                    style: borderStyleMap[String(styleId)] || 'thin',
                    color: { argb: argb }
                };
            };
            bList.forEach((bInfo, idx) => {
                try {

                    if (bInfo.rangeType === 'range') {
                        const borderObj = getBorderObj(bInfo.style, bInfo.color);

                        // --- 场景 A: Range ---
                        if (bInfo.rangeType === 'range') {
                            const borderObj = getBorderObj(bInfo.style, bInfo.color);

                            // 遍历该规则下的所有区域
                            bInfo.range.forEach((rng) => {
                                for (let r = rng.row[0]; r <= rng.row[1]; r++) {
                                    for (let c = rng.column[0]; c <= rng.column[1]; c++) {
                                        // ExcelJS 索引从1开始
                                        const cell = worksheet.getCell(r + 1, c + 1);

                                        // 🔥 关键点：确保 border 对象已初始化，否则无法设置单边
                                        if (!cell.border) cell.border = {};

                                        // 🔥 关键修复：不再只认 border-all，而是支持所有类型
                                        switch (bInfo.borderType) {
                                            case 'border-all':
                                                // 全边框：直接覆盖
                                                cell.border = { top: borderObj, bottom: borderObj, left: borderObj, right: borderObj };
                                                break;
                                            case 'border-top':
                                                cell.border.top = borderObj;
                                                break;
                                            case 'border-bottom':
                                                cell.border.bottom = borderObj;
                                                break;
                                            case 'border-left':
                                                cell.border.left = borderObj;
                                                break;
                                            case 'border-right':
                                                cell.border.right = borderObj;
                                                break;
                                            case 'border-none':
                                                cell.border = {}; // 清除边框
                                                break;
                                            default:
                                                // 忽略不支持的类型，但不报错
                                                break;
                                        }
                                    }
                                }
                            });
                        }
                    }
                    // --- 场景 B: Cell ---
                    else if (bInfo.rangeType === 'cell' && bInfo.value) {
                        const { row_index, col_index } = bInfo.value;
                        const cell = worksheet.getCell(row_index + 1, col_index + 1);
                        const currentBorder = cell.border || {};
                        const v = bInfo.value;

                        if (v.l) currentBorder.left = getBorderObj(v.l.style, v.l.color);
                        if (v.r) currentBorder.right = getBorderObj(v.r.style, v.r.color);
                        if (v.t) currentBorder.top = getBorderObj(v.t.style, v.t.color);
                        if (v.b) currentBorder.bottom = getBorderObj(v.b.style, v.b.color);

                        cell.border = currentBorder;
                    } else {
                        console.warn(`  -> ⚠️ 无法识别的规则结构:`, bInfo);
                    }
                } catch (e) {
                    console.error(`[DEBUG-ERR] 处理第 ${idx} 条规则时崩溃:`, e);
                }
            });
            console.groupEnd();
        }

        // ============================================================
        // 🔥【步骤 6】处理数据验证 (使用 worksheet.add 方法)
        // 这种方法生成的 XML 结构更标准，更容易被 LuckyExcel 识别
        // ============================================================
        // 兼容写法：规则可能在根目录，也可能在 config 下
        const rawVerifications = sheet.dataVerification || (sheet.config && sheet.config.dataVerification);

        if (rawVerifications) {
            console.log(`[Exporter] Sheet "${sheetName}" 开始写入 ${Object.keys(rawVerifications).length} 条验证规则...`);

            Object.entries(rawVerifications).forEach(([key, rule]) => {
                // key 格式例如 "3_4" (Row 3, Col 4 -> E4)
                const parts = key.split('_');
                if (parts.length !== 2) return;

                const r = parseInt(parts[0], 10);
                const c = parseInt(parts[1], 10);

                // 🔥 关键：将坐标转换为 Excel 地址 (如 "A1")
                const address = getExcelAddress(r, c);

                // 生成标准验证对象
                const validationObj = createValidationObject(rule);

                if (validationObj) {
                    // 使用 worksheet 级别的方法添加，兼容性更好
                    try {
                        worksheet.dataValidations.add(address, validationObj);
                    } catch (err) {
                        console.warn(`验证规则写入失败 [${address}]:`, err);
                    }
                }
            });
        }

        // 7. 处理合并单元格
        if (sheet.config && sheet.config.merge) {
            Object.values(sheet.config.merge).forEach(m => {
                try {
                    worksheet.mergeCells(
                        m.r + 1,
                        m.c + 1,
                        m.r + m.rs,
                        m.c + m.cs
                    );
                } catch (e) {
                    // console.warn 合并失败通常可以忽略
                }
            });
        }

        // 8. 处理图片
        if (sheet.images && typeof sheet.images === 'object') {
            for (const imageId in sheet.images) {
                const img = sheet.images[imageId];
                const imgDefault = img ? (img.default || img) : null;

                if (!img || !img.src || !imgDefault) continue;

                try {
                    const base64Parts = img.src.split(',');
                    if (base64Parts.length < 2) continue;
                    const base64Data = base64Parts[1];

                    const imageIdInWorkbook = workbook.addImage({
                        base64: base64Data,
                        extension: getImageExtension(img.src)
                    });

                    const { left, top, width, height } = imgDefault;

                    const anchor = getExcelImageTwoCellAnchor(
                        left, top, width, height,
                        sheet.config?.columnlen || {},
                        sheet.config?.rowlen || {}
                    );

                    worksheet.addImage(imageIdInWorkbook, {
                        tl: anchor.tl,
                        br: anchor.br,
                        editAs: 'twoCell'
                    });
                } catch (e) {
                    console.warn('导出图片时发生错误:', e);
                }
            }
        }
    }

    // 生成 Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    console.log("✅ 【Luckysheet Exporter】构建完成，文件大小:", buffer.byteLength);

    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// =============================================================================
//  辅助函数库
// =============================================================================

/**
 * 🔥【核心逻辑】生成符合 Excel 标准的验证对象
 */
function createValidationObject(rule) {
    if (!rule) return null;

    let validation = {
        allowBlank: true,
        showErrorMessage: true
    };

    // --- 类型 1: 下拉列表 (dropdown) ---
    if (rule.type === 'dropdown') {
        validation.type = 'list';
        let formulaStr = rule.value1 || "";

        // 1. 兼容性清洗
        if (!formulaStr.startsWith('=') && !formulaStr.includes('!')) {
            formulaStr = formulaStr.replace(/，/g, ',');
        }

        // 2. 引用 vs 列表
        const isFormula = formulaStr.startsWith('=');

        if (isFormula) {
            // [引用模式] (例如 =Sheet1!A1:A5)
            validation.formulae = [formulaStr];
        } else {
            // [列表模式] (例如 "确认,驳回")
            // 必须强制包裹双引号，这是 ExcelJS/Excel 的规范
            formulaStr = formulaStr.replace(/^"|"$/g, '');
            validation.formulae = [`"${formulaStr}"`];
        }
    }

    // --- 类型 2: 数值验证 ---
    else if (['number', 'number_integer', 'number_decimal'].includes(rule.type)) {
        const v1 = Number(rule.value1);
        const v2 = Number(rule.value2);

        if (isNaN(v1)) return null;

        validation.type = (rule.type === 'number_decimal') ? 'decimal' : 'whole';

        const opMap = {
            'bw': 'between', 'nb': 'notBetween', 'eq': 'equal', 'ne': 'notEqual',
            'gt': 'greaterThan', 'lt': 'lessThan', 'gte': 'greaterThanOrEqual', 'lte': 'lessThanOrEqual'
        };
        validation.operator = opMap[rule.type2] || 'between';

        if (['between', 'notBetween'].includes(validation.operator)) {
            validation.formulae = [v1, !isNaN(v2) ? v2 : v1];
        } else {
            validation.formulae = [v1];
        }
    }

    // --- 类型 3: 文本长度 ---
    else if (rule.type === 'text_length') {
        const v1 = Number(rule.value1);
        const v2 = Number(rule.value2);
        if (isNaN(v1)) return null;

        validation.type = 'textLength';
        const opMap = { 'bw': 'between', 'nb': 'notBetween', 'eq': 'equal', 'ne': 'notEqual', 'gt': 'greaterThan', 'lt': 'lessThan', 'gte': 'greaterThanOrEqual', 'lte': 'lessThanOrEqual' };
        validation.operator = opMap[rule.type2] || 'between';

        if (['between', 'notBetween'].includes(validation.operator)) {
            validation.formulae = [v1, !isNaN(v2) ? v2 : v1];
        } else {
            validation.formulae = [v1];
        }
    }

    // --- 类型 4: 复选框 ---
    else if (rule.type === 'checkbox') {
        validation.type = 'list';
        validation.formulae = ['"TRUE,FALSE"'];
        validation.showErrorMessage = false;
    }

    // --- 类型 5: 日期 ---
    else if (rule.type === 'date') {
        validation.type = 'date';
        const opMap = { 'bw': 'between', 'nb': 'notBetween', 'eq': 'equal', 'ne': 'notEqual', 'bf': 'lessThan', 'nbf': 'greaterThanOrEqual', 'af': 'greaterThan', 'naf': 'lessThanOrEqual' };
        validation.operator = opMap[rule.type2] || 'between';

        const d1 = new Date(rule.value1);
        const d2 = new Date(rule.value2 || rule.value1);

        if (isNaN(d1.getTime())) return null;

        if (['between', 'notBetween'].includes(validation.operator)) {
            validation.formulae = [d1, d2];
        } else {
            validation.formulae = [d1];
        }
    } else {
        return null; // 不支持的类型
    }

    return validation;
}

/**
 * 坐标转换：(0,0) -> "A1"
 */
function getExcelAddress(rowIndex, colIndex) {
    let colName = '';
    let dividend = colIndex + 1;
    let modulo;
    while (dividend > 0) {
        modulo = (dividend - 1) % 26;
        colName = String.fromCharCode(65 + modulo) + colName;
        dividend = Math.floor((dividend - 1) / 26);
    }
    return `${colName}${rowIndex + 1}`;
}

/**
 * 样式映射
 */
function mapLuckysheetStyleToExcelJS(luckysheetCell) {
    if (!luckysheetCell) return {};
    const style = {};
    const font = {};
    const alignment = {};
    const fill = {};
    const border = {};

    if (luckysheetCell.bl === 1) font.bold = true;
    if (luckysheetCell.it === 1) font.italic = true;
    if (luckysheetCell.cl === 1) font.strike = true;
    if (luckysheetCell.ul === 1) font.underline = true;
    if (luckysheetCell.ff) font.name = luckysheetCell.ff;
    if (luckysheetCell.fs) font.size = parseInt(luckysheetCell.fs);
    if (luckysheetCell.fc) font.color = { argb: luckysheetCell.fc.replace('#', 'FF') };

    if (luckysheetCell.bg) {
        fill.type = 'pattern';
        fill.pattern = 'solid';
        fill.fgColor = { argb: luckysheetCell.bg.replace('#', 'FF') };
    }

    if (luckysheetCell.ht === 0) alignment.horizontal = 'center';
    else if (luckysheetCell.ht === 1) alignment.horizontal = 'left';
    else if (luckysheetCell.ht === 2) alignment.horizontal = 'right';

    if (luckysheetCell.vt === 0) alignment.vertical = 'middle';
    else if (luckysheetCell.vt === 1) alignment.vertical = 'top';
    else if (luckysheetCell.vt === 2) alignment.vertical = 'bottom';

    if (luckysheetCell.tb === 2) alignment.wrapText = true;

    if (luckysheetCell.bd) {
        const typeMap = { "1": "thin", "2": "hair", "3": "dotted", "4": "dashed", "5": "dashDot", "6": "dashDotDot", "7": "double", "8": "medium", "9": "mediumDashed", "10": "mediumDashDot", "11": "mediumDashDotDot", "12": "slantDashDot", "13": "thick" };
        const mapBorder = (bdCfg) => {
            if (!bdCfg) return undefined;
            return { style: typeMap[bdCfg.style] || 'thin', color: { argb: (bdCfg.color || '#000000').replace('#', 'FF') } };
        };
        const t = mapBorder(luckysheetCell.bd.t);
        const b = mapBorder(luckysheetCell.bd.b);
        const l = mapBorder(luckysheetCell.bd.l);
        const r = mapBorder(luckysheetCell.bd.r);
        if (t) border.top = t; if (b) border.bottom = b; if (l) border.left = l; if (r) border.right = r;
    }

    if (Object.keys(font).length > 0) style.font = font;
    if (Object.keys(alignment).length > 0) style.alignment = alignment;
    if (Object.keys(fill).length > 0) style.fill = fill;
    if (Object.keys(border).length > 0) style.border = border;

    return style;
}

/**
 * 图片扩展名
 */
function getImageExtension(dataUrl) {
    if (!dataUrl) return 'png';
    const mimeMatch = dataUrl.match(/data:image\/(.*?);/);
    const ext = mimeMatch ? mimeMatch[1] : 'png';
    return ext === 'jpeg' ? 'jpeg' : ext;
}

/**
 * 图片锚点计算
 */
function getExcelImageTwoCellAnchor(left, top, width, height, colLen, rowLen) {
    const defaultColWidth = 73;
    const defaultRowHeight = 19;
    const EMU_PER_PIXEL = 9525;

    let currentX = 0, startCol = 0, startColOffPx = 0;
    for (let c = 0; c < 16384; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (left < currentX + currentW) { startCol = c; startColOffPx = left - currentX; break; }
        currentX += currentW;
    }

    let currentY = 0, startRow = 0, startRowOffPx = 0;
    for (let r = 0; r < 1048576; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (top < currentY + currentH) { startRow = r; startRowOffPx = top - currentY; break; }
        currentY += currentH;
    }

    const tlAnchor = { col: startCol, row: startRow, colOff: Math.round(startColOffPx * EMU_PER_PIXEL), rowOff: Math.round(startRowOffPx * EMU_PER_PIXEL) };

    const endX = left + width;
    const endY = top + height;

    currentX = 0;
    let endCol = 0, endColOffPx = 0;
    for (let c = 0; c < 16384; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (endX <= currentX + currentW) { endCol = c; endColOffPx = endX - currentX; break; }
        currentX += currentW;
    }

    currentY = 0;
    let endRow = 0, endRowOffPx = 0;
    for (let r = 0; r < 1048576; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (endY <= currentY + currentH) { endRow = r; endRowOffPx = endY - currentY; break; }
        currentY += currentH;
    }

    const brAnchor = { col: endCol, row: endRow, colOff: Math.round(endColOffPx * EMU_PER_PIXEL), rowOff: Math.round(endRowOffPx * EMU_PER_PIXEL) };

    return { tl: tlAnchor, br: brAnchor };
}