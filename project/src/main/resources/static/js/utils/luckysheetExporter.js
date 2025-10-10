// /js/utils/luckysheetExporter.js

/**
 * 【最终通用版】
 * 将 Luckysheet 的数据对象或数组转换为可下载的 .xlsx 文件 Blob。
 * 能够智能处理来自 postMessage 的 payload 和来自 getAllSheets() 的数组。
 * 包含对样式、合并、数据验证和图片的完整支持。
 * 
 * @param {object | Array} dataSource - Luckysheet 数据源。
 * @returns {Promise<Blob>} 一个包含 .xlsx 文件内容的 Blob 对象。
 */
export async function exportWithExcelJS(dataSource) {
    console.log("【Luckysheet Exporter】: 开始使用最终通用模块进行文件构建...");

    // --- 【【【 核心修正：智能解析数据源 】】】 ---
    let sheetsArray;

    if (Array.isArray(dataSource)) {
        // 场景1: “一键导出”，直接传入 luckysheet.getAllSheets() 的数组
        sheetsArray = dataSource;
    } else if (dataSource && dataSource.sheets && typeof dataSource.sheets === 'object') {
        // 场景2: “保存”，传入包含 sheets 对象的 payload
        sheetsArray = Object.values(dataSource.sheets);
    } else {
        // 无效数据格式
        console.error("【Luckysheet Exporter】: 传入的数据格式无效。", dataSource);
        throw new Error("工作表数据格式不正确");
    }

    if (!sheetsArray || sheetsArray.length === 0) {
        throw new Error("工作表数据为空");
    }
    // --- 修正结束 ---

    const workbook = new ExcelJS.Workbook();

    // 现在 sheetsArray 始终是一个标准数组
    const sortedSheets = sheetsArray.sort((a, b) => a.order - b.order);

    for (const sheet of sortedSheets) { // 现在可以安全地使用 for...of 循环
        if (!sheet) continue;
        const worksheet = workbook.addWorksheet(sheet.name);

        // 1. 设置列宽和行高
        if (sheet.config) {
            if (sheet.config.columnlen) { Object.entries(sheet.config.columnlen).forEach(([colIndex, width]) => { worksheet.getColumn(parseInt(colIndex) + 1).width = width / 8; }); }
            if (sheet.config.rowlen) { Object.entries(sheet.config.rowlen).forEach(([rowIndex, height]) => { worksheet.getRow(parseInt(rowIndex) + 1).height = height * 0.75; }); }
        }

        // 2. 遍历所有单元格
        (sheet.celldata || []).forEach(cellData => {
            const cell = worksheet.getCell(cellData.r + 1, cellData.c + 1);
            const luckysheetCell = cellData.v;
            if (luckysheetCell) {
                if (luckysheetCell.f) { // 公式
                    const formulaText = luckysheetCell.f.startsWith('=') 
                        ? luckysheetCell.f.substring(1) 
                        : luckysheetCell.f;
                    cell.value = { formula: formulaText };
                } else if (luckysheetCell.ct && luckysheetCell.ct.v !== undefined && luckysheetCell.ct.v !== null) {
                    cell.value = luckysheetCell.ct.v;
                } else {
                    cell.value = luckysheetCell.m !== undefined ? luckysheetCell.m : luckysheetCell.v;
                }
                Object.assign(cell, mapLuckysheetStyleToExcelJS(luckysheetCell));
            } else {
                cell.value = null;
                cell.style = {};
            }
        });

        // 3. 处理合并单元格
        if (sheet.config && sheet.config.merge) {
            Object.values(sheet.config.merge).forEach(merge => {
                worksheet.mergeCells(merge.r + 1, merge.c + 1, merge.r + merge.rs, merge.c + merge.cs);
            });
        }

        // 4. 处理数据验证
        if (sheet.dataVerification) {
            Object.entries(sheet.dataVerification).forEach(([luckysheetRange, rule]) => {
                if (rule.type === 'dropdown') {
                    const excelAddress = convertLuckysheetRangeToExcel(luckysheetRange);
                    if (excelAddress) {
                        worksheet.dataValidations.add(excelAddress, {
                            type: 'list',
                            allowBlank: rule.prohibitInput !== true,
                            formulae: [`"${rule.value1}"`],
                            showErrorMessage: true, errorStyle: 'warning', errorTitle: '输入无效', error: '请从下拉列表中选择一个有效值。'
                        });
                    }
                }
            });
        }

        // 5. 处理图片
        if (sheet.images && typeof sheet.images === 'object') {
            for (const imageId in sheet.images) {
                const img = sheet.images[imageId];
                const imgDefault = img ? img.default : null;
                if (!img || !img.src || !imgDefault) continue;
                const { left, top, width, height } = imgDefault;
                if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) continue;
                const base64Data = img.src.split(',')[1];
                if (!base64Data) continue;

                const imageIdInWorkbook = workbook.addImage({ base64: base64Data, extension: getImageExtension(img.src) });
                const anchor = getExcelImageTwoCellAnchor(left, top, width, height, sheet.config?.columnlen || {}, sheet.config?.rowlen || {});
                worksheet.addImage(imageIdInWorkbook, { tl: anchor.tl, br: anchor.br, editAs: 'twoCell' });
            }
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    console.log("✅ 【Luckysheet Exporter】成功生成文件 Buffer，大小:", buffer.byteLength);
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


// --- 以下是所有的辅助函数，保持不变 ---

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
    if (luckysheetCell.fs) font.size = luckysheetCell.fs;
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
        const luckysheetBorderTypeMap = { "1": "thin", "2": "hair", "3": "dotted", "4": "dashed", "5": "dashDot", "6": "dashDotDot", "7": "double", "8": "medium", "9": "mediumDashed", "10": "mediumDashDot", "11": "mediumDashDotDot", "12": "slantDashDot", "13": "thick" };
        const processBorder = (borderConfig) => {
            if (!borderConfig) return undefined;
            return { style: luckysheetBorderTypeMap[borderConfig.style] || 'thin', color: { argb: (borderConfig.color || '#000000').replace('#', 'FF') } };
        };
        const top = processBorder(luckysheetCell.bd.t);
        const bottom = processBorder(luckysheetCell.bd.b);
        const left = processBorder(luckysheetCell.bd.l);
        const right = processBorder(luckysheetCell.bd.r);
        if (top) border.top = top;
        if (bottom) border.bottom = bottom;
        if (left) border.left = left;
        if (right) border.right = right;
    }
    if (Object.keys(font).length > 0) style.font = font;
    if (Object.keys(alignment).length > 0) style.alignment = alignment;
    if (Object.keys(fill).length > 0) style.fill = fill;
    if (Object.keys(border).length > 0) style.border = border;
    return style;
}

function getImageExtension(dataUrl) {
    if (!dataUrl) return 'png';
    const mimeMatch = dataUrl.match(/data:image\/(.*?);/);
    const ext = mimeMatch ? mimeMatch[1] : 'png';
    return ext === 'jpeg' ? 'jpeg' : ext;
}

function getExcelImageTwoCellAnchor(left, top, width, height, colLen, rowLen) {
    const defaultColWidth = 73;
    const defaultRowHeight = 19;
    const EMU_PER_PIXEL = 9525;
    let currentX = 0, startCol = 0, startColOffPx = 0;
    for (let c = 0; c < 512; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (left < currentX + currentW) { startCol = c; startColOffPx = left - currentX; break; }
        currentX += currentW;
    }
    let currentY = 0, startRow = 0, startRowOffPx = 0;
    for (let r = 0; r < 4096; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (top < currentY + currentH) { startRow = r; startRowOffPx = top - currentY; break; }
        currentY += currentH;
    }
    const tlAnchor = { col: startCol, row: startRow, colOff: startColOffPx * EMU_PER_PIXEL, rowOff: startRowOffPx * EMU_PER_PIXEL };
    const endX = left + width;
    const endY = top + height;
    currentX = 0;
    let endCol = 0, endColOffPx = 0;
    for (let c = 0; c < 512; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (endX <= currentX + currentW) { endCol = c; endColOffPx = endX - currentX; break; }
        currentX += currentW;
    }
    currentY = 0;
    let endRow = 0, endRowOffPx = 0;
    for (let r = 0; r < 4096; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (endY <= currentY + currentH) { endRow = r; endRowOffPx = endY - currentY; break; }
        currentY += currentH;
    }
    const brAnchor = { col: endCol, row: endRow, colOff: endColOffPx * EMU_PER_PIXEL, rowOff: endRowOffPx * EMU_PER_PIXEL };
    return { tl: tlAnchor, br: brAnchor };
}

function convertLuckysheetRangeToExcel(luckysheetRange) {
    const parts = luckysheetRange.split('_');
    if (parts.length !== 2) { return null; }
    const r = parseInt(parts[0], 10);
    const c = parseInt(parts[1], 10);
    let colName = '';
    let tempC = c;
    while (tempC >= 0) {
        colName = String.fromCharCode((tempC % 26) + 65) + colName;
        tempC = Math.floor(tempC / 26) - 1;
    }
    const rowNum = r + 1;
    return `${colName}${rowNum}`;
}