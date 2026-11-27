"""Read-only diagnostics for the Kali VM used by SLBG."""
import platform
import subprocess
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Kali VM Status", host="192.168.64.2", port=8001,
              stateless_http=True, json_response=True)


@mcp.tool()
def kali_status() -> dict:
    """Report guest OS version, uptime and the system service manager's state."""
    state = subprocess.run(["/usr/bin/systemctl", "is-system-running"],
                           capture_output=True, text=True, timeout=3)
    return {"os": platform.freedesktop_os_release()["PRETTY_NAME"],
            "uptime_seconds": int(float(Path("/proc/uptime").read_text().split()[0])),
            "services": state.stdout.strip()}


@mcp.tool()
def disk_space() -> str:
    """Report total, used and available space on the Kali root filesystem."""
    return subprocess.check_output(["/usr/bin/df", "-h", "/"], text=True, timeout=3)


@mcp.tool()
def memory_usage() -> str:
    """Report available RAM, used memory and swap on the Kali VM."""
    return subprocess.check_output(["/usr/bin/free", "-h"], text=True, timeout=3)


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
