/**
 * AIXX CLI - aci 命令（已并入 market，1030）
 * 保留命令名只为老用户指路；全部能力在 aixx market 命令组。
 */

export async function aci() {
  console.log('该命令已升级并入 aixx market，请改用：');
  console.log('  aixx market tickers            全标的快照');
  console.log('  aixx market ticker <SYMBOL>    单标的快照');
  console.log('  aixx market score <SYMBOL>     标的记分卡');
  console.log('  aixx market history <SYMBOL>   历史点位');
  console.log('  aixx market detail <SYMBOL>    大宗详情数据包');
  console.log('  aixx market consumer <型号>    消费级详情数据包');
}

export { aci as default };
