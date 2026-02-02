import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist, isEmailRegistered } from "@/lib/waitlist";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Check for duplicates
    if (await isEmailRegistered(email)) {
      return NextResponse.json(
        { error: "This email is already registered." },
        { status: 409 }
      );
    }

    // Save email
    await addToWaitlist(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
