// /js/utils/luckysheetExporter.js

/**
 * 【核心导出模块】
 * 将 Luckysheet 的完整数据对象转换为可下载的 .xlsx 文件 Blob。
 * @param {object} luckysheetData - 从 iframe 的 postMessage 中获取的包含 sheets, images 的数据对象。
 * @returns {Promise<Blob>} 一个包含 .xlsx 文件内容的 Blob 对象。
 */
export async function exportWithExcelJS(luckysheetData) {
    console.log("【Luckysheet Exporter】: 开始使用独立模块进行文件构建...");
    const { sheets } = luckysheetData;
    if (!sheets || sheets.length === 0) { throw new Error("工作表数据为空"); }

    const workbook = new ExcelJS.Workbook();

    for (const sheet of sheets) {
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
                if (luckysheetCell.f) {
                    cell.formula = luckysheetCell.f.substring(1);
                } else {
                    cell.value = luckysheetCell.m !== undefined ? luckysheetCell.m : luckysheetCell.v;
                }
                // 【注意】这里调用的是下面的辅助函数，不再需要`this.`
                cell.style = mapLuckysheetStyleToExcelJS(luckysheetCell);
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
                    // 【注意】调用辅助函数，无`this.`
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

                // 【注意】调用辅助函数，无`this.`
                const imageIdInWorkbook = workbook.addImage({ base64: base64Data, extension: getImageExtension(img.src) });
                const anchor = getExcelImageTwoCellAnchor(left, top, width, height, sheet.config?.columnlen || {}, sheet.config?.rowlen || {});
                worksheet.addImage(imageIdInWorkbook, { tl: anchor.tl, br: anchor.br, editAs: 'twoCell' });
            }
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    console.log("✅ 【Luckysheet Exporter】成功生成文件 Buffer，大小:", buffer.byteLength);
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.ml.sheet' });
}

/**
         * 【完全版】: 将 Luckysheet 单元格样式映射到 ExcelJS 样式 (含边框)
         * @param {object} luckysheetCell - Luckysheet 的单元格对象 (cellData.v)
         * @returns {object} ExcelJS 的 style 对象
         */
function mapLuckysheetStyleToExcelJS(luckysheetCell) {
    if (!luckysheetCell) return {}; // 安全检查

    const style = {};
    const font = {};
    const alignment = {};
    const fill = {};
    const border = {}; // 新增：边框对象

    // --- 字体 ---
    if (luckysheetCell.bl === 1) font.bold = true;
    if (luckysheetCell.it === 1) font.italic = true;
    if (luckysheetCell.cl === 1) font.strike = true; // 删除线
    if (luckysheetCell.ul === 1) font.underline = true; // 下划线
    if (luckysheetCell.ff) font.name = luckysheetCell.ff;
    if (luckysheetCell.fs) font.size = luckysheetCell.fs;
    if (luckysheetCell.fc) font.color = { argb: luckysheetCell.fc.replace('#', 'FF') };

    // --- 背景填充 (此功能已存在且正确) ---
    if (luckysheetCell.bg) {
        fill.type = 'pattern';
        fill.pattern = 'solid';
        fill.fgColor = { argb: luckysheetCell.bg.replace('#', 'FF') };
    }

    // --- 对齐 ---
    if (luckysheetCell.ht === 0) alignment.horizontal = 'center';
    else if (luckysheetCell.ht === 1) alignment.horizontal = 'left';
    else if (luckysheetCell.ht === 2) alignment.horizontal = 'right';

    if (luckysheetCell.vt === 0) alignment.vertical = 'middle';
    else if (luckysheetCell.vt === 1) alignment.vertical = 'top';
    else if (luckysheetCell.vt === 2) alignment.vertical = 'bottom';

    if (luckysheetCell.tb === 2) alignment.wrapText = true;

    // --- 【核心新增】边框处理 ---
    if (luckysheetCell.bd) {
        // Luckysheet 边框类型到 ExcelJS 的映射
        const luckysheetBorderTypeMap = {
            "1": "thin", "2": "hair", "3": "dotted", "4": "dashed",
            "5": "dashDot", "6": "dashDotDot", "7": "double", "8": "medium",
            "9": "mediumDashed", "10": "mediumDashDot", "11": "mediumDashDotDot",
            "12": "slantDashDot", "13": "thick"
        };

        const processBorder = (borderConfig) => {
            if (!borderConfig) return undefined;
            return {
                style: luckysheetBorderTypeMap[borderConfig.style] || 'thin',
                color: { argb: (borderConfig.color || '#000000').replace('#', 'FF') }
            };
        };

        // 分别处理 上、下、左、右 边框
        const top = processBorder(luckysheetCell.bd.t);
        const bottom = processBorder(luckysheetCell.bd.b);
        const left = processBorder(luckysheetCell.bd.l);
        const right = processBorder(luckysheetCell.bd.r);

        if (top) border.top = top;
        if (bottom) border.bottom = bottom;
        if (left) border.left = left;
        if (right) border.right = right;
    }

    // --- 组合最终的 style 对象 ---
    if (Object.keys(font).length > 0) style.font = font;
    if (Object.keys(alignment).length > 0) style.alignment = alignment;
    if (Object.keys(fill).length > 0) style.fill = fill;
    if (Object.keys(border).length > 0) style.border = border;

    return style;
}

/**
 * 【复活的辅助函数】: 计算图片左上角的精确单元格锚点
 */
function getExcelImageAnchor(left, top, colLen, rowLen) {
    const defaultColWidth = 73;
    const defaultRowHeight = 19;
    const EMU_PER_PIXEL = 9525;

    let currentX = 0, startCol = 0, startColOffPx = 0;
    for (let c = 0; c < 512; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (left < currentX + currentW) {
            startCol = c;
            startColOffPx = left - currentX;
            break;
        }
        currentX += currentW;
    }

    let currentY = 0, startRow = 0, startRowOffPx = 0;
    for (let r = 0; r < 4096; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (top < currentY + currentH) {
            startRow = r;
            startRowOffPx = top - currentY;
            break;
        }
        currentY += currentH;
    }

    return {
        col: startCol,
        row: startRow,
        colOff: startColOffPx * EMU_PER_PIXEL,
        rowOff: startRowOffPx * EMU_PER_PIXEL,
    };
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

    // --- 计算左上角 ('tl') 锚点 ---
    let currentX = 0, startCol = 0, startColOffPx = 0;
    for (let c = 0; c < 512; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (left < currentX + currentW) {
            startCol = c;
            startColOffPx = left - currentX;
            break;
        }
        currentX += currentW;
    }

    let currentY = 0, startRow = 0, startRowOffPx = 0;
    for (let r = 0; r < 4096; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (top < currentY + currentH) {
            startRow = r;
            startRowOffPx = top - currentY;
            break;
        }
        currentY += currentH;
    }
    const tlAnchor = { col: startCol, row: startRow, colOff: startColOffPx * EMU_PER_PIXEL, rowOff: startRowOffPx * EMU_PER_PIXEL };

    // --- 计算右下角 ('br') 锚点 ---
    const endX = left + width;
    const endY = top + height;

    currentX = 0;
    let endCol = 0, endColOffPx = 0;
    for (let c = 0; c < 512; c++) {
        const currentW = colLen[c] === undefined ? defaultColWidth : colLen[c];
        if (endX <= currentX + currentW) {
            endCol = c;
            endColOffPx = endX - currentX;
            break;
        }
        currentX += currentW;
    }

    currentY = 0;
    let endRow = 0, endRowOffPx = 0;
    for (let r = 0; r < 4096; r++) {
        const currentH = rowLen[r] === undefined ? defaultRowHeight : rowLen[r];
        if (endY <= currentY + currentH) {
            endRow = r;
            endRowOffPx = endY - currentY;
            break;
        }
        currentY += currentH;
    }
    const brAnchor = { col: endCol, row: endRow, colOff: endColOffPx * EMU_PER_PIXEL, rowOff: endRowOffPx * EMU_PER_PIXEL };

    // 【核心修正】: 返回 tl 和 br，而不是 from 和 to
    return { tl: tlAnchor, br: brAnchor };
}

function convertLuckysheetRangeToExcel(luckysheetRange) {
    // Luckysheet 的数据验证范围通常是单个单元格的 r_c 格式
    const parts = luckysheetRange.split('_');
    if (parts.length !== 2) {
        console.warn(`无法解析的 Luckysheet 范围格式: ${luckysheetRange}，已跳过。`);
        return null;
    }

    const r = parseInt(parts[0], 10); // 0-based row index
    const c = parseInt(parts[1], 10); // 0-based col index

    // 将 0-based 列索引转换为 'A', 'B', 'Z', 'AA' 等
    let colName = '';
    let tempC = c;
    while (tempC >= 0) {
        colName = String.fromCharCode((tempC % 26) + 65) + colName;
        tempC = Math.floor(tempC / 26) - 1;
    }

    // Excel 行号是 1-based
    const rowNum = r + 1;

    return `${colName}${rowNum}`;
}