import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="py-1 md:py-3 pr-2 mx-3 md:mx-6 my-3 flex items-center">
      <Link
        href="https://openspacedev.ru"
        className="flex items-center gap-2 mr-4  hidden md:block"
      >
        <Image src="/icons/openspace.svg" alt="Logo" width={48} height={48} />
      </Link>
      <p className="h-[80%] border-1 hidden md:block"></p>
      <Link href="/" className="flex items-center gap-2 md:ml-4">
        <Image src="/icons/logo.svg" alt="Logo" width={48} height={48} />
      </Link>
      <div className="grow"></div>
      <div className="flex items-center justify-center gap-4">
        <a
          href="https://www.npmjs.com/package/gittomd"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline-offset-2 font-medium"
        >
          <div className=" p-2 border border-foreground/20 rounded-lg backdrop-blur-md transition-opacity opacity-80 hover:opacity-100 max-w-sm">
            <p className="text-sm text-foreground flex gap-2 items-center ">
              <svg
                viewBox="0 0 2500 2500"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
              >
                <path
                  d="M1241.5 268.5h-973v1962.9h972.9V763.5h495v1467.9h495V268.5z"
                  fill="#fff"
                  className="fill-foreground transition-colors"
                />
              </svg>
              Try also gittomd-cli
            </p>
          </div>
        </a>
        <Link
          href={"https://github.com/OpenSpace-Dev/gittomd"}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src={"/icons/gh.svg"}
            alt="GitHub Logo"
            width={20}
            height={20}
          />
        </Link>
      </div>
    </header>
  );
}
