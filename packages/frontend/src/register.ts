import { startRegistration } from "@simplewebauthn/browser";
import { UAParser } from "ua-parser-js";

function appendFooter(text: string) {
  const footer = document.createElement("footer");
  footer.append(text);
  document.body.appendChild(footer);
}

function getDeviceName() {
  const parser = new UAParser();
  const device = parser.getDevice();
  if (device.type) {
    return `${device.vendor} ${device.model}`;
  }
  const browser = parser.getBrowser();
  return `${browser.name} ${browser.version}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  // retrieve options
  try {
    const optionsResponse = await fetch(document.URL + "/options");
    const options = await optionsResponse.json();
    if (!optionsResponse.ok) {
      return appendFooter(
        `Error retrieving registration options: ${JSON.stringify(options)}`
      );
    }

    const registrationResponse = await fetch(document.URL + "/verify", {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credential: await startRegistration(options),
        displayName: getDeviceName(),
      }),
    });
    const registration = await registrationResponse.json();
    if (!registrationResponse.ok) {
      return appendFooter(
        `Authentication error: ${JSON.stringify(registration)}`
      );
    }

    return appendFooter(`JWT: ${registration.jwt}`);
  } catch (err) {
    console.error(err);
  }
});
