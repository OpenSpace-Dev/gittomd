import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mx-6 flex py-4 items-center justify-between text-sm *:hover:opacity-100 *:opacity-50 *:transition-opacity">
      
      <div className="flex gap-2">
        <Link
        href={"https://t.me/openspaceteam"}
        target="_blank"
        rel="noopener noreferrer"
      >OpenSpace Dev
      </Link>
      </div>
      <Link
        href={"https://github.com/OpenSpace-Dev/gittomd"}
        target="_blank"
        rel="noopener noreferrer"
      >
        Please, star us &lt;3
      </Link>
    </footer>
  );
}
