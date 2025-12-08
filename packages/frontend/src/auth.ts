import { startAuthentication } from "@simplewebauthn/browser";

function appendFooter(text: string) {
  const footer = document.createElement("footer");
  footer.append(text);
  document.body.appendChild(footer);
}

async function authenticate() {
  try {
    const optionsResponse = await fetch("options");
    const options = await optionsResponse.json();
    if (!optionsResponse.ok) {
      return appendFooter(
        `Error retrieving authentication options: ${JSON.stringify(options)}`
      );
    }

    const authResponse = await fetch("verify", {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response: await startAuthentication(options),
        challengeValidator: options.challengeValidator
      }),
    });
    const auth = await authResponse.json();
    if (!authResponse.ok) {
      appendFooter(`Authentication error: ${JSON.stringify(auth)}`)
    } else {
      const redirectUrl = new URLSearchParams(window.location.search).get('u')
      if (!!redirectUrl) {
        window.location.href = redirectUrl
      } else {
        appendFooter(`JWT: ${auth.jwt}`)
      }
    }
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("button");
  button.textContent = "Use PassKey";
  button.addEventListener("click", authenticate);
  document.body.appendChild(button);
});
