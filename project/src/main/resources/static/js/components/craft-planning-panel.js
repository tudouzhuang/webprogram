Vue.component('craft-planning-panel', {
    template: `
            <div class="content-wrapper">
                <h1>工艺策划面板</h1>
                <p>这里是工艺策划页面的测试。</p>
                <!-- 例如，在这里可以放一个Element UI的表格 -->
                <el-table :data="tableData" style="width: 100%">
                    <el-table-column prop="date" label="日期" width="180"></el-table-column>
                    <el-table-column prop="name" label="姓名" width="180"></el-table-column>
                    <el-table-column prop="address" label="地址"></el-table-column>
                </el-table>
            </div>
    `,
    data() {
        return {
            tableData: [{
                date: '2024-05-02',
                name: '王小虎',
                address: '上海市普陀区金沙江路 1518 弄'
            }, {
                date: '2024-05-04',
                name: '王小虎',
                address: '上海市普陀区金沙江路 1517 弄'
            }]
        }
    }
});