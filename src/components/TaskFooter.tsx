import { COMPANY_NAME, OPENING_HOURS, PHONE_DISPLAY, PHONE_HREF, SITE_NAME } from "@/lib/site";

/** The slim footer that goes with TaskHeader. */
export default function TaskFooter() {
  return (
    <footer className="site-chrome mt-auto bg-plum-night text-[15px] text-on-plum-muted">
      <div className="site-container flex flex-wrap justify-between gap-x-8 gap-y-3 py-7">
        <span>
          &copy; {SITE_NAME} · {COMPANY_NAME}
        </span>
        <a href={PHONE_HREF} className="hover:text-white">
          {OPENING_HOURS} · {PHONE_DISPLAY}
        </a>
      </div>
    </footer>
  );
}
