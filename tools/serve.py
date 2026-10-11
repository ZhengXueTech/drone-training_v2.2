# -*- coding: utf-8 -*-
"""
newdrone 本機開發伺服器（取代 python -m http.server）
唯一差異：所有回應都加 Cache-Control: no-store ——
瀏覽器每次都抓最新檔案，杜絕「更新後舊模組被快取、
import 新匯出失敗導致整關進不去」的問題（2026-07-20 實測踩坑）。
用法：python tools/serve.py [port]（預設 8765，於專案根目錄執行）
"""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    # 2026-10-11 首頁的平板連線 QR Code：回傳這台電腦在區網的網址
    def do_GET(self):
        if self.path.split('?')[0] == '/lan.json':
            import json
            scheme = 'https' if globals().get('HTTPS') else 'http'
            b = json.dumps({'ok': True, 'urls': [f'{scheme}://{ip}:{PORT}/' for ip in _lan_ips()]}).encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        return super().do_GET()
    # .js 一律以正確 MIME 供應（ES Modules 必須）
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript'}

# 2026-09-30 修正（使用者回報：關卡偶爾一開始沒有畫面，重進又正常）：
# 原本用單執行緒 TCPServer，Chrome 會「預先連線」開一條空連線先放著，
# 單執行緒伺服器卡在等這條連線送資料，其他所有請求（關卡的 JS 模組）都排隊
# 等不到 → 畫面空白，直到 Chrome 自己放棄那條連線才恢復。實測可 100% 重現。
# 改成多執行緒（每條連線各自一個執行緒），空連線不再擋住其他請求。
class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

def _lan_ips():
    ips = set()
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('10.255.255.255', 1)); ips.add(s.getsockname()[0]); s.close()
    except Exception: pass
    try:
        import socket
        for a in socket.gethostbyname_ex(socket.gethostname())[2]: ips.add(a)
    except Exception: pass
    return sorted(i for i in ips if not i.startswith('127.'))

with ThreadingServer(('', PORT), NoCacheHandler) as httpd:
    print(f'newdrone dev server (no-cache) on http://localhost:{PORT}/')
    for _ip in _lan_ips():
        print(f'  平板／手機請連：http://{_ip}:{PORT}/')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
