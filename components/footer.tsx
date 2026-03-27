import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* About */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">K9Hope</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            India's first AI-powered canine blood donation network.
                        </p>
                        <div className="mt-4">
                            <a
                                href="https://k9hope.in"
                                className="text-blue-600 hover:underline text-sm"
                            >
                                k9hope.in
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">Quick Links</h3>
                        <ul className="space-y-2 text-sm">
                            <li><a href="/about" className="text-gray-600 hover:text-blue-600">About Us</a></li>
                            <li><a href="/how-it-works" className="text-gray-600 hover:text-blue-600">How It Works</a></li>
                            <li><a href="/contact" className="text-gray-600 hover:text-blue-600">Contact</a></li>
                        </ul>
                    </div>

                    {/* Developers */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">Developed By</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            RIT Chennai CSE Department
                        </p>
                        <ul className="text-sm text-gray-600 mt-2 space-y-1">
                            <li>Vikram T</li>
                            <li>Prem Kumar</li>
                            <li>Ramkishore</li>
                        </ul>
                    </div>

                    {/* Links */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">Resources</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a
                                    href="https://github.com/Rvunveil/k9hope-canine-blood-donation"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-600 hover:text-blue-600 flex items-center gap-1"
                                >
                                    <Github className="h-4 w-4" />
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/Rvunveil/k9hope-canine-blood-donation/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-600 hover:text-blue-600"
                                >
                                    Report Issue
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t mt-8 pt-6 text-center text-sm text-gray-600">
                    <p>© {new Date().getFullYear()} K9Hope. Built with ❤️ by RIT Chennai CSE.</p>
                    <p className="mt-1">
                        <a href="https://k9hope.in" className="text-blue-600 hover:underline">k9hope.in</a>
                        {" | "}
                        <a href="https://github.com/Rvunveil/k9hope-canine-blood-donation" className="text-blue-600 hover:underline">
                            GitHub
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}
