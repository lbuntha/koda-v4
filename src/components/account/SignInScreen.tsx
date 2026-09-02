import React from "react";

import { themeSystem } from "../../lib/themeSystem";
import { AccountForm } from "./AccountForm";

/**
 * The sign-in page.
 *
 * A page in its own right rather than a panel dropped into whatever is behind
 * it: it owns the full viewport and its own background, so it can be routed to
 * from a landing page without inheriting that page's layout.
 *
 * It takes no props and offers no way past — signing in is required (App.tsx),
 * so an escape hatch here would lead nowhere. Once a device *has* signed in the
 * session is local and lessons keep working with no connection; this screen is
 * the one thing that needs a network, on a device that has never used it.
 */
export const SignInScreen: React.FC = () => (
  <div className="min-h-screen w-full bg-canvas flex flex-col items-center justify-center px-4 py-10">
    <div className="w-full max-w-[400px]">
      {/*
       * The product's own mark, not a stock shield.
       *
       * A padlock says "security", which is not the feeling wanted at the front
       * door of a children's maths app, and it is the icon every login screen
       * uses so it carries no information. This is `public/favicon.svg` — the
       * same tile that sits on the home screen once the app is installed, so a
       * parent opening it recognises where they are.
       *
       * Referenced by URL rather than inlined: one file, one definition, and
       * changing the brand changes it everywhere at once.
       */}
      <div className="text-center mb-7">
        <img
          src="/favicon.svg"
          alt=""
          width={64}
          height={64}
          className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-lg shadow-indigo-600/25"
        />
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">
          Learning your child asks for
        </h1>
        {/*
         * Specific, and one line.
         *
         * "Maths practice for ages 5–8" named a category and an age band —
         * the sentence every children's app on the store writes. The
         * techniques are what make it this app rather than any of them, and a
         * child recognises them too: they know what counting is. The headline
         * above does the selling, so this only has to say what is inside.
         *
         * The offline promise and the evidence sit at the foot of the page,
         * where a parent looks after deciding to read on rather than before.
        */}
        <p className="mt-2 text-sm text-muted">
          Kids’ maths practice: counting, addition and number bonds. Ages 5–11.
        </p>
      </div>

      <div className={themeSystem.card("default", "p-5 sm:p-6")}>
        <AccountForm autoFocus />
      </div>

      {/*
       * The offline promise, restated where a parent decides whether to bother.
       *
       * It is the one genuinely unusual thing about this app on a tablet that
       * shares a household's patchy wifi, and it reads as reassurance rather
       * than as a feature list.
      */}
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        Works offline after sign-in
      </p>
    </div>
  </div>
);
